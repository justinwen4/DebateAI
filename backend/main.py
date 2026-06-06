import asyncio
import json
import logging
import os
import sys
from contextlib import asynccontextmanager
from typing import Literal

from dotenv import load_dotenv

logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from pydantic import BaseModel, Field
from supabase import Client, create_client

load_dotenv()

from services.auth import AuthUser, require_user
from services.limits import (
    FEEDBACK_DAILY_LIMIT,
    GENERATE_DAILY_LIMIT,
    MAX_FEEDBACK_NOTES_CHARS,
    MAX_FEEDBACK_TEXT_CHARS,
    MAX_PROMPT_CHARS,
    MAX_TRAINING_AREA_CHARS,
    MAX_TRAINING_FILE_BYTES,
    SONNET_MONTHLY_LIMIT,
    TITLE_DAILY_LIMIT,
    TRAINING_DAILY_LIMIT,
    MAX_TITLE_CHARS,
    enforce_rate_limit,
    validate_history,
)
from services.llm import generate_title, stream_generate_response_sync
from services.metrics import fetch_product_metrics, is_admin_configured, verify_admin_key
from services.rag import retrieve, seed_from_dataset
from services.usage import get_monthly_count, pick_model_for_generation, record_generation

_supabase: Client | None = None


def _get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_KEY"]
        _supabase = create_client(url, key)
    return _supabase


logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)

_is_production = os.environ.get("ENVIRONMENT", "development").lower() == "production"


@asynccontextmanager
async def lifespan(app: FastAPI):
    count = await asyncio.to_thread(seed_from_dataset)
    logger.info("[rag] %d documents in vector store", count)
    yield


app = FastAPI(
    title="DebateAI",
    lifespan=lifespan,
    docs_url=None if _is_production else "/docs",
    redoc_url=None if _is_production else "/redoc",
    openapi_url=None if _is_production else "/openapi.json",
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

def _parse_allowed_origins(raw: str) -> list[str]:
    origins: list[str] = []
    for origin in raw.split(","):
        cleaned = origin.strip().rstrip("/")
        if cleaned:
            origins.append(cleaned)
    return origins


_allowed_origins = _parse_allowed_origins(
    os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000")
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Admin-Key"],
)


class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=MAX_PROMPT_CHARS)
    history: list[dict[str, str]] | None = None


def _sse_event(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


@app.post("/generate")
@limiter.limit("200/hour")
async def generate(
    request: Request,
    req: GenerateRequest,
    user: AuthUser = Depends(require_user),
):
    enforce_rate_limit(user.id, "generate", GENERATE_DAILY_LIMIT)
    valid_history = validate_history(req.history)
    prompt = req.prompt.strip()
    supabase = _get_supabase()

    try:
        current_count, context = await asyncio.gather(
            asyncio.to_thread(get_monthly_count, supabase, user.id),
            retrieve(prompt, slot_query=prompt),
        )
        model, notice = pick_model_for_generation(current_count)
    except HTTPException:
        raise
    except Exception:
        logger.exception("generate prep failed user=%s", user.id)
        raise HTTPException(status_code=500, detail="Generation failed") from None

    def event_stream():
        try:
            for chunk in stream_generate_response_sync(
                prompt,
                context=context,
                history=valid_history,
                model=model,
            ):
                if chunk:
                    yield _sse_event({"type": "chunk", "text": chunk})

            monthly_usage = record_generation(supabase, user.id)
            model_tier: Literal["premium", "standard"] = (
                "premium" if monthly_usage <= SONNET_MONTHLY_LIMIT else "standard"
            )
            yield _sse_event(
                {
                    "type": "done",
                    "model_tier": model_tier,
                    "monthly_usage": monthly_usage,
                    "premium_monthly_limit": SONNET_MONTHLY_LIMIT,
                    "notice": notice,
                }
            )
        except HTTPException as exc:
            yield _sse_event({"type": "error", "detail": str(exc.detail), "status": exc.status_code})
        except Exception:
            logger.exception("generate stream failed user=%s", user.id)
            yield _sse_event({"type": "error", "detail": "Generation failed", "status": 500})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


class TitleRequest(BaseModel):
    user_message: str = Field(..., min_length=1, max_length=500)
    assistant_message: str = Field(..., min_length=1, max_length=500)


class TitleResponse(BaseModel):
    title: str


@app.post("/generate-title", response_model=TitleResponse)
@limiter.limit("200/hour")
async def generate_conversation_title(
    request: Request,
    req: TitleRequest,
    user: AuthUser = Depends(require_user),
):
    enforce_rate_limit(user.id, "generate_title", TITLE_DAILY_LIMIT)
    fallback = req.user_message.strip()[:MAX_TITLE_CHARS]
    try:
        title = await generate_title(
            req.user_message.strip(),
            req.assistant_message.strip(),
            fallback=fallback,
        )
    except Exception:
        logger.exception("generate-title failed user=%s", user.id)
        title = fallback
    return TitleResponse(title=title)


class FeedbackRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=MAX_FEEDBACK_TEXT_CHARS)
    output: str = Field(..., min_length=1, max_length=MAX_FEEDBACK_TEXT_CHARS)
    rating: int = Field(ge=1, le=5)
    notes: str = Field(default="", max_length=MAX_FEEDBACK_NOTES_CHARS)
    curation_eligible: bool = False


def _require_admin(
    authorization: str | None = Header(default=None),
    x_admin_key: str | None = Header(default=None, alias="X-Admin-Key"),
) -> None:
    if not is_admin_configured():
        raise HTTPException(status_code=503, detail="Admin metrics are not configured")
    token: str | None = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
    elif x_admin_key:
        token = x_admin_key.strip()
    if not verify_admin_key(token):
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/admin/metrics")
async def admin_metrics(
    days: int = Query(default=30, ge=1, le=365),
    _: None = Depends(_require_admin),
):
    try:
        return fetch_product_metrics(_get_supabase(), days=days)
    except Exception:
        logger.exception("admin metrics failed")
        raise HTTPException(status_code=500, detail="Failed to fetch metrics") from None


@app.post("/training-request")
@limiter.limit("100/hour")
async def training_request(
    request: Request,
    area: str = Form(...),
    file: UploadFile | None = File(default=None),
    user: AuthUser = Depends(require_user),
):
    enforce_rate_limit(user.id, "training-request", TRAINING_DAILY_LIMIT)
    area = area.strip()
    if not area:
        raise HTTPException(status_code=400, detail="Area description is required")
    if len(area) > MAX_TRAINING_AREA_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Area description must be at most {MAX_TRAINING_AREA_CHARS} characters.",
        )

    payload: dict[str, str] = {"area": area, "user_id": user.id}
    if file and file.filename:
        content = await file.read(MAX_TRAINING_FILE_BYTES + 1)
        if len(content) > MAX_TRAINING_FILE_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"File must be at most {MAX_TRAINING_FILE_BYTES // 1024} KB.",
            )
        if b"\x00" in content[:4096]:
            raise HTTPException(status_code=400, detail="Binary files are not supported.")
        payload["file_name"] = file.filename
        payload["file_content"] = content.decode("utf-8", errors="replace")

    try:
        _get_supabase().table("training_requests").insert(payload).execute()
    except Exception:
        payload.pop("user_id", None)
        try:
            _get_supabase().table("training_requests").insert(payload).execute()
        except Exception:
            logger.exception("training request failed user=%s", user.id)
            raise HTTPException(status_code=500, detail="Failed to save training request") from None
    return {"status": "ok"}


@app.post("/feedback")
@limiter.limit("100/hour")
async def feedback(
    request: Request,
    req: FeedbackRequest,
    user: AuthUser = Depends(require_user),
):
    enforce_rate_limit(user.id, "feedback", FEEDBACK_DAILY_LIMIT)
    payload = {
        "prompt": req.prompt,
        "bad_output": req.output,
        "rating": req.rating,
        "notes": req.notes,
        "curation_eligible": req.curation_eligible,
        "user_id": user.id,
    }
    try:
        _get_supabase().table("feedback").insert(payload).execute()
    except Exception:
        payload.pop("user_id", None)
        try:
            _get_supabase().table("feedback").insert(payload).execute()
        except Exception:
            payload.pop("curation_eligible", None)
            try:
                _get_supabase().table("feedback").insert(payload).execute()
            except Exception:
                logger.exception("feedback failed user=%s", user.id)
                raise HTTPException(status_code=500, detail="Failed to save feedback") from None
    return {"status": "ok"}
