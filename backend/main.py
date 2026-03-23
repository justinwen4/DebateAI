from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

from services.llm import generate_response
from services.rag import retrieve, seed_from_dataset


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
