from fastapi import FastAPI, APIRouter, HTTPException, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import json
import logging
import uuid
import hashlib
import secrets
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
CLAUDE_MODEL = "claude-sonnet-4-5-20250929"
SESSION_TTL_DAYS = 7

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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProfileCreate(BaseModel):
    name: str
    goal: str
    level: str
    days_per_week: int


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
    )


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
        '    {"name": str, "muscle_group": str, "equipment_needed": str, "sets": int, "reps": str, '
        '     "rest_seconds": int, "instructions": str}'
        '  ]}'
        ']'
        "}. "
        "Number of days MUST equal the user's days_per_week. Pick splits appropriate for level and goal. "
        "Keep instructions to 1-2 short sentences. reps may be '8-12' or '30 sec'."
    )
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"plan-{uuid.uuid4()}",
        system_message=system,
    ).with_model("anthropic", CLAUDE_MODEL)

    user_text = (
        f"User profile:\n"
        f"- Goal: {profile.get('goal')}\n"
        f"- Level: {profile.get('level')}\n"
        f"- Days per week: {profile.get('days_per_week')}\n"
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
async def update_profile(user_id: str, p: ProfileCreate):
    await db.profiles.update_one({"id": user_id}, {"$set": p.dict()})
    doc = await db.profiles.find_one({"id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Profile not found")
    return Profile(**doc)


@api_router.post("/scan", response_model=ScanResult)
async def scan_equipment(req: ScanRequest):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "LLM key not configured")
    if not req.images_base64:
        raise HTTPException(400, "At least one image is required")
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
    # update streak: simple increment if last session was yesterday or today
    await db.profiles.update_one({"id": s.user_id}, {"$inc": {"streak": 1}})
    return sess


@api_router.get("/sessions/{user_id}", response_model=List[SessionLog])
async def list_sessions(user_id: str):
    cur = db.sessions.find({"user_id": user_id}, {"_id": 0}).sort("date", -1)
    docs = await cur.to_list(100)
    return [SessionLog(**d) for d in docs]


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============ Auth Routes ============
@api_router.post("/auth/signup", response_model=AuthResponse)
async def auth_signup(req: SignupRequest):
    email = req.email.lower()
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


app.include_router(api_router)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
