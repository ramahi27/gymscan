from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import json
import logging
import uuid
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from datetime import datetime, timezone

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
CLAUDE_MODEL = "claude-sonnet-4-5-20250929"

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


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
