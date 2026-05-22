# DebateAI — Debate Analytics Assistant

A chatbot that generates high-quality, natural-sounding debate analytics in the style of competitive debaters. Dense reasoning, fluid prose, zero bullet points.

## Stack

| Layer    | Tech                                |
|----------|-------------------------------------|
| Frontend | Next.js 16, TypeScript, TailwindCSS |
| Backend  | FastAPI, Python                     |
| LLM      | Anthropic API (Claude Sonnet 4.6)   |
| Auth/DB  | Supabase                            |
| RAG      | ChromaDB (local vector store)       |
| Training | LoRA fine-tuning scaffold (`ml/train.py`) |

## Quick Start

### 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add your keys (see below)
uvicorn main:app --reload
```

The API runs at `http://localhost:8000`. On startup it seeds the vector store from `ml/dataset.tutor.jsonl` (not in git — add your corpus locally).

**Backend `.env` variables:**

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Claude generation |
| `SUPABASE_URL` | Feedback storage |
| `SUPABASE_KEY` | Supabase service role key |

### 2. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # or create .env.local manually
npm run dev
```

Open `http://localhost:3000`.

**Frontend `.env.local` variables:**

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_API_URL` | Backend URL (default `http://localhost:8000`) |

## API

**POST /generate**

```json
{
  "prompt": "Why does fairness outweigh education?",
  "history": [
    { "role": "user", "content": "What is fairness in debate theory?" },
    { "role": "assistant", "content": "Fairness is reciprocal ground..." }
  ]
}
```

```json
{ "output": "Fairness outweighs—it's a gateway issue..." }
```

**POST /feedback**

```json
{
  "prompt": "Why does fairness outweigh education?",
  "output": "Fairness outweighs...",
  "rating": 3,
  "notes": "Needs a clearer mechanism in sentence two.",
  "curation_eligible": true
}
```

`curation_eligible` should be `true` only for feedback attached to the first user turn in a chat. This keeps follow-up prompts like "can you elaborate?" out of training curation.

## Project Structure

```
/backend
  main.py              # FastAPI app
  services/
    llm.py             # Anthropic generation
    rag.py             # ChromaDB retrieval
/frontend              # Next.js chat UI (Supabase auth)
/ml
  dataset.tutor.jsonl  # debate training data (gitignored)
  llm_utils.py         # shared LLM retry helpers
  prompts.py           # rewrite prompts for curation
  train.py             # LoRA fine-tuning scaffold
```

## Deployment

The repo includes a `Dockerfile` and `railway.toml` for Railway deployment.

## Roadmap

- [x] Chat UI
- [x] Claude-powered generation
- [x] RAG with debate analytics corpus
- [x] Supabase auth and feedback
- [x] Production deployment (Railway)
- [ ] LoRA fine-tuned local model
- [ ] Expanded dataset
