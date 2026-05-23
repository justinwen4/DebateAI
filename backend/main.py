import asyncio
import logging
import os
import sys
from contextlib import asynccontextmanager

from dotenv import load_dotenv

logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel, Field
from supabase import create_client, Client

load_dotenv()

from services.llm import generate_response
from services.rag import retrieve, seed_from_dataset

_supabase: Client | None = None


def _get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_KEY"]
        _supabase = create_client(url, key)
    return _supabase


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    count = await asyncio.to_thread(seed_from_dataset)
    logger.info("[rag] %d documents in vector store", count)
    yield


app = FastAPI(title="DebateAI", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class GenerateRequest(BaseModel):
    prompt: str
    history: list[dict[str, str]] | None = None


class GenerateResponse(BaseModel):
    output: str


@app.post("/generate", response_model=GenerateResponse)
async def generate(req: GenerateRequest):
    try:
        history = req.history or []
        valid_history = [
            turn
            for turn in history
            if isinstance(turn.get("content"), str)
            and turn.get("role") in {"user", "assistant"}
            and turn.get("content").strip()
        ]
        rag_history = valid_history[-8:]
        rag_query_parts = [turn["content"].strip() for turn in rag_history]
        rag_query_parts.append(req.prompt)
        rag_query = "\n".join(rag_query_parts)

        context = await retrieve(rag_query)
        output = await generate_response(req.prompt, context=context, history=valid_history)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {e}")
    return GenerateResponse(output=output)


class FeedbackRequest(BaseModel):
    prompt: str
    output: str
    rating: int = Field(ge=1, le=5)
    notes: str = ""
    curation_eligible: bool = False


@app.post("/feedback")
async def feedback(req: FeedbackRequest):
    try:
        payload = {
            "prompt": req.prompt,
            "bad_output": req.output,
            "rating": req.rating,
            "notes": req.notes,
            "curation_eligible": req.curation_eligible,
        }
        try:
            _get_supabase().table("feedback").insert(payload).execute()
        except Exception:
            # Backward compatibility if DB schema does not yet include the new column.
            payload.pop("curation_eligible", None)
            _get_supabase().table("feedback").insert(payload).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save feedback: {e}")
    return {"status": "ok"}
