import json
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()

from services.llm import generate_response
from services.rag import retrieve, seed_from_dataset

FEEDBACK_PATH = os.path.join(os.path.dirname(__file__), "..", "ml", "feedback.jsonl")


@asynccontextmanager
async def lifespan(app: FastAPI):
    count = seed_from_dataset()
    print(f"[rag] {count} documents in vector store")
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


class GenerateResponse(BaseModel):
    output: str


@app.post("/generate", response_model=GenerateResponse)
async def generate(req: GenerateRequest):
    context = retrieve(req.prompt)
    output = generate_response(req.prompt, context=context)
    return GenerateResponse(output=output)


class FeedbackRequest(BaseModel):
    prompt: str
    output: str
    rating: int = Field(ge=1, le=5)
    notes: str = ""


@app.post("/feedback")
async def feedback(req: FeedbackRequest):
    entry = {
        "prompt": req.prompt,
        "bad_output": req.output,
        "rating": req.rating,
        "notes": req.notes,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    with open(FEEDBACK_PATH, "a") as f:
        f.write(json.dumps(entry) + "\n")
    return {"status": "ok"}
