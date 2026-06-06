from fastapi import FastAPI, APIRouter, HTTPException, Header, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import json
import logging
import time
import uuid
import hashlib
import secrets
from collections import defaultdict
from pathlib import Path
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Any, Dict
from datetime import datetime, timezone, timedelta

import httpx
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-5-20250929")
EXERCISE_DB_API_KEY = os.environ.get('EXERCISE_DB_API_KEY', '')
SESSION_TTL_DAYS = 7
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "")
FREE_SCAN_LIMIT = 5

# In-memory rate limiter for auth endpoints (per email/IP, 10 attempts per 5 min)
_rate_buckets: Dict[str, List[float]] = defaultdict(list)
_RATE_WINDOW = 300
_RATE_MAX = 10

def _check_rate_limit(key: str) -> None:
    now = time.time()
    bucket = _rate_buckets[key]
    bucket[:] = [t for t in bucket if now - t < _RATE_WINDOW]
    if len(bucket) >= _RATE_MAX:
        raise HTTPException(429, "Too many attempts. Please wait before trying again.")
    bucket.append(now)

ALLOWED_GOALS = {"weight_loss", "muscle_gain", "endurance"}
ALLOWED_LEVELS = {"beginner", "intermediate", "advanced"}

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ============ Models ============
class Profile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    goal: str  # weight_loss | muscle_gain | endurance
    level: str  # beginner | intermediate | advanced
    days_per_week: int
    streak: int = 0
    is_pro: bool = False
    scans_used: int = 0
    # extended fields (v4)
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    gender: Optional[str] = None  # male | female | unspecified
    unit_pref: str = "metric"  # metric | imperial
    photo_b64: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProfileCreate(BaseModel):
    name: str
    goal: str
    level: str
    days_per_week: int
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    gender: Optional[str] = None
    unit_pref: Optional[str] = None


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    goal: Optional[str] = None
    level: Optional[str] = None
    days_per_week: Optional[int] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    gender: Optional[str] = None
    unit_pref: Optional[str] = None
    photo_b64: Optional[str] = None


class ScanRequest(BaseModel):
    user_id: str
    images_base64: List[str]  # list of base64 (no prefix)


class DetectedEquipment(BaseModel):
    name: str
    confidence: Optional[str] = None
    category: Optional[str] = None


class ScanResult(BaseModel):
    id: str
    user_id: str
    detected_equipment: List[DetectedEquipment]
    created_at: datetime


class PlanRequest(BaseModel):
    user_id: str
    scan_id: Optional[str] = None
    equipment: List[str]


class WorkoutPlan(BaseModel):
    id: str
    user_id: str
    scan_id: Optional[str] = None
    plan: Dict[str, Any]
    created_at: datetime


class SessionLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    plan_id: str
    day_index: int
    completed_exercises: List[Dict[str, Any]] = []
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SessionCreate(BaseModel):
    user_id: str
    plan_id: str
    day_index: int
    completed_exercises: List[Dict[str, Any]] = []


# ============ Auth Models ============
class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class SigninRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleSessionRequest(BaseModel):
    session_token: str  # short-lived token from Emergent OAuth


class AuthUser(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    profile_id: Optional[str] = None
    is_admin: bool = False


class AuthResponse(BaseModel):
    token: str
    user: AuthUser


class ResetRequest(BaseModel):
    email: EmailStr


# ============ Auth helpers ============
def _hash_password(pw: str) -> str:
    salt = secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 200_000)
    return f"{salt}${h.hex()}"


def _verify_password(pw: str, stored: str) -> bool:
    try:
        salt, hexhash = stored.split("$", 1)
    except ValueError:
        return False
    h = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 200_000)
    return secrets.compare_digest(h.hex(), hexhash)


async def _create_session(user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    await db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "created_at": now,
        "expires_at": now + timedelta(days=SESSION_TTL_DAYS),
    })
    return token


async def _ensure_profile_for_user(user_id: str, name: str) -> str:
    existing = await db.profiles.find_one({"auth_user_id": user_id}, {"_id": 0})
    if existing:
        return existing["id"]
    prof = Profile(name=name, goal="muscle_gain", level="beginner", days_per_week=3)
    doc = prof.dict()
    doc["auth_user_id"] = user_id
    await db.profiles.insert_one(doc)
    return prof.id


async def _resolve_user_from_token(authorization: Optional[str]) -> Dict[str, Any]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        raise HTTPException(401, "Invalid session")
    exp = sess["expires_at"]
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        raise HTTPException(401, "Session expired")
    user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


def _to_auth_user(user_doc: Dict[str, Any]) -> AuthUser:
    return AuthUser(
        user_id=user_doc["user_id"],
        email=user_doc["email"],
        name=user_doc.get("name", ""),
        picture=user_doc.get("picture"),
        profile_id=user_doc.get("profile_id"),
        is_admin=(user_doc.get("email", "").lower() == ADMIN_EMAIL.lower()),
    )


async def _require_admin(authorization: Optional[str]) -> Dict[str, Any]:
    user = await _resolve_user_from_token(authorization)
    if (user.get("email") or "").lower() != ADMIN_EMAIL.lower():
        raise HTTPException(403, "Admin only")
    return user


# ============ Helpers ============
def _extract_json(text: str) -> Any:
    """Robustly extract a JSON object/array from an LLM response."""
    text = text.strip()
    # strip ```json fences
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    # find first { or [ ... last } or ]
    start = min([i for i in [text.find('{'), text.find('[')] if i != -1], default=-1)
    if start == -1:
        raise ValueError("No JSON found in model output")
    end_obj = text.rfind('}')
    end_arr = text.rfind(']')
    end = max(end_obj, end_arr)
    snippet = text[start:end + 1]
    return json.loads(snippet)


async def _claude_vision_detect(images_b64: List[str]) -> List[Dict[str, Any]]:
    system = (
        "You are a gym equipment detection expert. Given one or more photos of a gym, "
        "identify all distinct pieces of fitness equipment and machines visible. "
        "Return ONLY a valid JSON array (no prose) with objects of shape: "
        '{"name": str, "category": "machine"|"free_weight"|"cardio"|"bodyweight"|"accessory", "confidence": "high"|"medium"|"low"}. '
        "Be specific (e.g. 'Adjustable Dumbbells', 'Cable Crossover Machine', 'Smith Machine'). "
        "Do not include duplicates. If no equipment is visible, return []."
    )
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"vision-{uuid.uuid4()}",
        system_message=system,
    ).with_model("anthropic", CLAUDE_MODEL)

    image_contents = [ImageContent(image_base64=b64) for b64 in images_b64]
    msg = UserMessage(
        text="Detect all gym equipment in these photos. Return only the JSON array.",
        file_contents=image_contents,
    )
    reply = await chat.send_message(msg)
    data = _extract_json(reply)
    if not isinstance(data, list):
        raise ValueError("Vision did not return a list")
    return data


async def _claude_generate_plan(profile: Dict[str, Any], equipment: List[str]) -> Dict[str, Any]:
    system = (
        "You are an expert strength & conditioning coach. Generate a structured weekly workout plan "
        "using ONLY the equipment provided. Return ONLY a valid JSON object (no prose) with shape: "
        "{"
        '"split_name": str,'  # e.g. "Push/Pull/Legs" or "Full Body"
        '"days": ['
        '  {"day_index": int, "day_name": str, "focus": str, "exercises": ['
        '    {"name": str, "muscle_group": str, "equipment_needed": str, "sets": int, "reps": int, '
        '     "rest_seconds": int, "instructions": str}'
        '  ]}'
        ']'
        "}. "
        "Number of days MUST equal the user's days_per_week. Pick splits appropriate for level and goal. "
        "Keep instructions to 1-2 short sentences. "
        "IMPORTANT: 'reps' MUST be a single integer (e.g. 10), never a range like '8-12' and never a string."
    )
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"plan-{uuid.uuid4()}",
        system_message=system,
    ).with_model("anthropic", CLAUDE_MODEL)

    # Sanitize profile fields against known-good values before interpolating into the prompt
    goal = profile.get("goal") if profile.get("goal") in ALLOWED_GOALS else "muscle_gain"
    level = profile.get("level") if profile.get("level") in ALLOWED_LEVELS else "beginner"
    days_pw = profile.get("days_per_week", 3)
    if not isinstance(days_pw, int) or not (1 <= days_pw <= 7):
        days_pw = 3

    user_text = (
        f"User profile:\n"
        f"- Goal: {goal}\n"
        f"- Level: {level}\n"
        f"- Days per week: {days_pw}\n"
        f"Available equipment: {', '.join(equipment) if equipment else 'bodyweight only'}\n"
        f"Generate the plan JSON now."
    )
    reply = await chat.send_message(UserMessage(text=user_text))
    data = _extract_json(reply)
    if not isinstance(data, dict) or "days" not in data:
        raise ValueError("Plan did not return expected shape")
    return data


# ============ Routes ============
@api_router.get("/")
async def root():
    return {"message": "GymScan API"}


@api_router.post("/profile", response_model=Profile)
async def create_profile(p: ProfileCreate):
    if p.goal not in ALLOWED_GOALS:
        raise HTTPException(400, f"goal must be one of: {', '.join(sorted(ALLOWED_GOALS))}")
    if p.level not in ALLOWED_LEVELS:
        raise HTTPException(400, f"level must be one of: {', '.join(sorted(ALLOWED_LEVELS))}")
    if not (1 <= p.days_per_week <= 7):
        raise HTTPException(400, "days_per_week must be between 1 and 7 inclusive")
    prof = Profile(**p.dict())
    await db.profiles.insert_one(prof.dict())
    return prof


@api_router.get("/profile/{user_id}", response_model=Profile)
async def get_profile(user_id: str):
    doc = await db.profiles.find_one({"id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Profile not found")
    return Profile(**doc)


@api_router.put("/profile/{user_id}", response_model=Profile)
async def update_profile(user_id: str, p: ProfileUpdate):
    if p.goal is not None and p.goal not in ALLOWED_GOALS:
        raise HTTPException(400, f"goal must be one of: {', '.join(sorted(ALLOWED_GOALS))}")
    if p.level is not None and p.level not in ALLOWED_LEVELS:
        raise HTTPException(400, f"level must be one of: {', '.join(sorted(ALLOWED_LEVELS))}")
    if p.days_per_week is not None and not (1 <= p.days_per_week <= 7):
        raise HTTPException(400, "days_per_week must be between 1 and 7 inclusive")
    update = {k: v for k, v in p.dict().items() if v is not None}
    if update:
        await db.profiles.update_one({"id": user_id}, {"$set": update})
    doc = await db.profiles.find_one({"id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Profile not found")
    # strip non-Profile fields like auth_user_id
    doc.pop("auth_user_id", None)
    return Profile(**doc)


@api_router.post("/scan", response_model=ScanResult)
async def scan_equipment(req: ScanRequest):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "LLM key not configured")
    if not req.images_base64:
        raise HTTPException(400, "At least one image is required")
    if len(req.images_base64) > 10:
        raise HTTPException(400, "Maximum 10 images per scan")
    MAX_B64_BYTES = 7 * 1024 * 1024  # ~5 MB original image
    for img in req.images_base64:
        if len(img.encode()) > MAX_B64_BYTES:
            raise HTTPException(400, "One or more images exceed the 5 MB size limit. Please resize before scanning.")
    profile_doc = await db.profiles.find_one({"id": req.user_id}, {"_id": 0})
    if profile_doc and not profile_doc.get("is_pro", False):
        if profile_doc.get("scans_used", 0) >= FREE_SCAN_LIMIT:
            raise HTTPException(403, "Free plan limit reached (5 scans). Upgrade to Pro for unlimited scans.")
    try:
        detected_raw = await _claude_vision_detect(req.images_base64)
    except Exception as e:
        logger.exception("Vision detection failed")
        raise HTTPException(500, f"Vision detection failed: {str(e)}")

    detected = []
    seen = set()
    for d in detected_raw:
        if not isinstance(d, dict):
            continue
        name = (d.get("name") or "").strip()
        if not name or name.lower() in seen:
            continue
        seen.add(name.lower())
        detected.append({
            "name": name,
            "confidence": d.get("confidence", "medium"),
            "category": d.get("category", "machine"),
        })

    scan_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    doc = {
        "id": scan_id,
        "user_id": req.user_id,
        "detected_equipment": detected,
        "created_at": now,
    }
    await db.scans.insert_one(doc)
    # increment scans_used
    await db.profiles.update_one({"id": req.user_id}, {"$inc": {"scans_used": 1}})
    return ScanResult(id=scan_id, user_id=req.user_id,
                      detected_equipment=[DetectedEquipment(**d) for d in detected],
                      created_at=now)


@api_router.post("/plan", response_model=WorkoutPlan)
async def generate_plan(req: PlanRequest):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "LLM key not configured")
    profile_doc = await db.profiles.find_one({"id": req.user_id}, {"_id": 0})
    if not profile_doc:
        raise HTTPException(404, "Profile not found")
    try:
        plan_json = await _claude_generate_plan(profile_doc, req.equipment)
    except Exception as e:
        logger.exception("Plan generation failed")
        raise HTTPException(500, f"Plan generation failed: {str(e)}")

    plan_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    doc = {
        "id": plan_id,
        "user_id": req.user_id,
        "scan_id": req.scan_id,
        "plan": plan_json,
        "created_at": now,
    }
    await db.plans.insert_one(doc)
    return WorkoutPlan(id=plan_id, user_id=req.user_id, scan_id=req.scan_id,
                       plan=plan_json, created_at=now)


@api_router.get("/plans/{user_id}", response_model=List[WorkoutPlan])
async def list_plans(user_id: str):
    cur = db.plans.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1)
    docs = await cur.to_list(50)
    return [WorkoutPlan(**d) for d in docs]


@api_router.get("/plan/{plan_id}", response_model=WorkoutPlan)
async def get_plan(plan_id: str):
    doc = await db.plans.find_one({"id": plan_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Plan not found")
    return WorkoutPlan(**doc)


@api_router.post("/session", response_model=SessionLog)
async def log_session(s: SessionCreate):
    sess = SessionLog(**s.dict())
    await db.sessions.insert_one(sess.dict())

    # Fetch the most recent PREVIOUS session for this user (exclude the one just inserted)
    today_utc = datetime.now(timezone.utc).date()
    prev_cursor = db.sessions.find(
        {"user_id": s.user_id, "id": {"$ne": sess.id}},
        {"_id": 0, "date": 1},
    ).sort("date", -1).limit(1)
    prev_docs = await prev_cursor.to_list(1)

    if not prev_docs:
        # No prior session — start streak at 1
        await db.profiles.update_one({"id": s.user_id}, {"$set": {"streak": 1}})
    else:
        last_dt = prev_docs[0]["date"]
        if last_dt.tzinfo is None:
            last_dt = last_dt.replace(tzinfo=timezone.utc)
        last_date = last_dt.date()
        if last_date == today_utc:
            # Already counted today — no change
            pass
        elif last_date == today_utc - timedelta(days=1):
            # Consecutive day — extend streak
            await db.profiles.update_one({"id": s.user_id}, {"$inc": {"streak": 1}})
        else:
            # Gap of 2+ days — reset streak
            await db.profiles.update_one({"id": s.user_id}, {"$set": {"streak": 1}})

    return sess


@api_router.get("/sessions/{user_id}", response_model=List[SessionLog])
async def list_sessions(user_id: str):
    cur = db.sessions.find({"user_id": user_id}, {"_id": 0}).sort("date", -1)
    docs = await cur.to_list(100)
    return [SessionLog(**d) for d in docs]


_raw_origins = os.environ.get("ALLOWED_ORIGINS", "")
_allowed_origins: List[str] = [o.strip() for o in _raw_origins.split(",") if o.strip()] or ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


# ============ Auth Routes ============
@api_router.post("/auth/signup", response_model=AuthResponse)
async def auth_signup(req: SignupRequest):
    if not req.name or not req.name.strip():
        raise HTTPException(400, "Name must not be blank")
    if len(req.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    email = req.email.lower()
    _check_rate_limit(email)
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        raise HTTPException(409, "Email already registered")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    profile_id = await _ensure_profile_for_user(user_id, req.name)
    doc = {
        "user_id": user_id,
        "email": email,
        "name": req.name,
        "password_hash": _hash_password(req.password),
        "provider": "password",
        "profile_id": profile_id,
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(doc)
    await db.profiles.update_one({"id": profile_id}, {"$set": {"auth_user_id": user_id}})
    token = await _create_session(user_id)
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return AuthResponse(token=token, user=_to_auth_user(user_doc))


@api_router.post("/auth/signin", response_model=AuthResponse)
async def auth_signin(req: SigninRequest):
    email = req.email.lower()
    _check_rate_limit(email)
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not user.get("password_hash"):
        raise HTTPException(401, "Invalid email or password")
    if not _verify_password(req.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    token = await _create_session(user["user_id"])
    return AuthResponse(token=token, user=_to_auth_user(user))


@api_router.post("/auth/google", response_model=AuthResponse)
async def auth_google(req: GoogleSessionRequest):
    """Exchange Emergent OAuth session_token for our app session."""
    try:
        async with httpx.AsyncClient(timeout=15) as h:
            r = await h.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": req.session_token},
            )
            if r.status_code != 200:
                raise HTTPException(401, "Google verification failed")
            data = r.json()
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Auth provider error: {e}")
    email = (data.get("email") or "").lower()
    name = data.get("name") or email.split("@")[0]
    picture = data.get("picture")
    if not email:
        raise HTTPException(400, "No email in Google response")
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        profile_id = await _ensure_profile_for_user(user_id, name)
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "provider": "google",
            "profile_id": profile_id,
            "created_at": datetime.now(timezone.utc),
        })
        await db.profiles.update_one({"id": profile_id}, {"$set": {"auth_user_id": user_id}})
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    token = await _create_session(user["user_id"])
    return AuthResponse(token=token, user=_to_auth_user(user))


@api_router.get("/auth/me", response_model=AuthUser)
async def auth_me(authorization: Optional[str] = Header(None)):
    user = await _resolve_user_from_token(authorization)
    return _to_auth_user(user)


@api_router.post("/auth/logout")
async def auth_logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


@api_router.post("/auth/reset")
async def auth_reset(req: ResetRequest):
    # MOCKED: no email actually sent. Always returns success to avoid email-enumeration.
    return {"ok": True, "message": "If an account exists for this email, a reset link has been sent."}


# ============ Media (Admin-only writes) ============
class MediaUpload(BaseModel):
    exercise_key: str  # canonical key, lowercased exercise name
    content_type: str  # "image/gif" | "image/png" | "image/jpeg" | "image/webp"
    data_base64: str


class MediaItem(BaseModel):
    id: str
    exercise_key: str
    content_type: str
    data_base64: str
    uploaded_by: Optional[str] = None
    uploaded_at: datetime


def _normalise_key(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")


ALLOWED_MEDIA_TYPES = {"image/gif", "image/png", "image/jpeg", "image/webp"}
MAX_MEDIA_B64_BYTES = 10 * 1024 * 1024  # 10 MB limit for admin uploads

@api_router.post("/admin/media", response_model=MediaItem)
async def admin_upload_media(payload: MediaUpload, authorization: Optional[str] = Header(None)):
    admin = await _require_admin(authorization)
    key = _normalise_key(payload.exercise_key)
    if not key:
        raise HTTPException(400, "exercise_key required")
    if payload.content_type not in ALLOWED_MEDIA_TYPES:
        raise HTTPException(400, f"content_type must be one of: {', '.join(sorted(ALLOWED_MEDIA_TYPES))}")
    if len(payload.data_base64.encode()) > MAX_MEDIA_B64_BYTES:
        raise HTTPException(400, "File too large. Maximum 10 MB.")
    mid = str(uuid.uuid4())
    doc = {
        "id": mid,
        "exercise_key": key,
        "content_type": payload.content_type,
        "data_base64": payload.data_base64,
        "uploaded_by": admin["email"],
        "uploaded_at": datetime.now(timezone.utc),
    }
    await db.media.replace_one({"exercise_key": key}, doc, upsert=True)
    return MediaItem(**doc)


@api_router.get("/admin/media", response_model=List[MediaItem])
async def admin_list_media(authorization: Optional[str] = Header(None)):
    await _require_admin(authorization)
    docs = await db.media.find({}, {"_id": 0}).sort("uploaded_at", -1).to_list(500)
    return [MediaItem(**d) for d in docs]


@api_router.delete("/admin/media/{media_id}")
async def admin_delete_media(media_id: str, authorization: Optional[str] = Header(None)):
    await _require_admin(authorization)
    await db.media.delete_one({"id": media_id})
    return {"ok": True}


@api_router.get("/admin/items")
async def admin_list_items(authorization: Optional[str] = Header(None)):
    """Aggregate every distinct exercise (from all plans) and equipment (from all scans)
    so the admin panel can preload a complete master list, each with its current media
    (if uploaded) or null."""
    await _require_admin(authorization)
    exercises: Dict[str, Dict[str, Any]] = {}
    async for p in db.plans.find({}, {"_id": 0, "plan": 1}).limit(1000):
        for d in (p.get("plan", {}) or {}).get("days", []) or []:
            for ex in d.get("exercises", []) or []:
                name = (ex.get("name") or "").strip()
                if not name:
                    continue
                key = _normalise_key(name)
                if key not in exercises:
                    exercises[key] = {
                        "name": name,
                        "key": key,
                        "muscle_group": ex.get("muscle_group"),
                        "equipment_needed": ex.get("equipment_needed"),
                    }
    equipment: Dict[str, Dict[str, Any]] = {}
    async for s in db.scans.find({}, {"_id": 0, "detected_equipment": 1}).limit(1000):
        for e in s.get("detected_equipment", []) or []:
            name = (e.get("name") or "").strip()
            if not name:
                continue
            key = _normalise_key(name)
            if key not in equipment:
                equipment[key] = {"name": name, "key": key, "category": e.get("category")}

    media_docs = await db.media.find({}, {"_id": 0, "exercise_key": 1, "content_type": 1, "data_base64": 1, "id": 1}).to_list(2000)
    media_by_key = {m["exercise_key"]: m for m in media_docs}

    def attach(item: Dict[str, Any]) -> Dict[str, Any]:
        m = media_by_key.get(item["key"])
        item["media"] = (
            {"id": m["id"], "content_type": m["content_type"], "data_base64": m["data_base64"]}
            if m else None
        )
        return item

    return {
        "exercises": [attach(v) for v in sorted(exercises.values(), key=lambda x: x["name"].lower())],
        "equipment": [attach(v) for v in sorted(equipment.values(), key=lambda x: x["name"].lower())],
    }


@api_router.get("/media/{exercise_key}")
async def get_media_by_key(exercise_key: str):
    """Public read-only: returns base64 media for a given exercise key. 404 if not found."""
    key = _normalise_key(exercise_key)
    doc = await db.media.find_one({"exercise_key": key}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    return {
        "exercise_key": doc["exercise_key"],
        "content_type": doc["content_type"],
        "data_base64": doc["data_base64"],
    }


@api_router.get("/exercise-gif/{exercise_name}")
async def get_exercise_gif(exercise_name: str):
    """Return an animated GIF URL for the given exercise name.

    Priority:
      1. Admin-uploaded media (base64 data URI already served via /media/{key})
      2. ExerciseDB API lookup — result cached in MongoDB for 30 days
      3. Empty string → client falls back to SVG illustration
    """
    key = _normalise_key(exercise_name)
    if not key:
        return {"gif_url": ""}

    # Return cached result (positive or negative) to avoid repeated API calls
    cached = await db.exercise_gif_cache.find_one({"key": key}, {"_id": 0})
    if cached:
        return {"gif_url": cached.get("gif_url", "")}

    if not EXERCISE_DB_API_KEY:
        await db.exercise_gif_cache.update_one(
            {"key": key},
            {"$set": {"key": key, "gif_url": "", "cached_at": datetime.now(timezone.utc)}},
            upsert=True,
        )
        return {"gif_url": ""}

    gif_url = ""
    # Try the full name first, then progressively shorter forms for better matching
    search_terms = [exercise_name.lower()]
    words = exercise_name.lower().split()
    if len(words) > 1:
        search_terms.append(" ".join(words[:2]))   # first two words
        search_terms.append(words[0])              # just the first word

    try:
        async with httpx.AsyncClient(timeout=10) as h:
            for term in search_terms:
                r = await h.get(
                    f"https://exercisedb.p.rapidapi.com/exercises/name/{term}",
                    params={"limit": "5", "offset": "0"},
                    headers={
                        "X-RapidAPI-Key": EXERCISE_DB_API_KEY,
                        "X-RapidAPI-Host": "exercisedb.p.rapidapi.com",
                    },
                )
                if r.status_code == 200:
                    data = r.json()
                    if data and isinstance(data, list) and data[0].get("gifUrl"):
                        gif_url = data[0]["gifUrl"]
                        break
    except Exception:
        logger.exception("ExerciseDB GIF lookup failed: %s", exercise_name)

    await db.exercise_gif_cache.update_one(
        {"key": key},
        {"$set": {"key": key, "gif_url": gif_url, "cached_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {"gif_url": gif_url}


app.include_router(api_router)


@app.on_event("startup")
async def create_indexes():
    await db.users.create_index("email", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.profiles.create_index("id", unique=True)
    await db.profiles.create_index("auth_user_id")
    await db.scans.create_index("user_id")
    await db.plans.create_index("user_id")
    await db.sessions.create_index("user_id")
    await db.media.create_index("exercise_key", unique=True)
    await db.exercise_gif_cache.create_index("key", unique=True)
    await db.exercise_gif_cache.create_index("cached_at", expireAfterSeconds=30 * 24 * 3600)
    logger.info("Database indexes ensured")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
