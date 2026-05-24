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
| `ADMIN_API_KEY` | Secret for `GET /admin/metrics` (optional) |

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

**GET /admin/metrics** (requires `ADMIN_API_KEY`)

```bash
curl -H "Authorization: Bearer $ADMIN_API_KEY" \
  "http://localhost:8000/admin/metrics?days=30"
```

```json
{
  "summary": {
    "period_days": 30,
    "active_users": 3,
    "total_prompts": 42,
    "conversations_started": 8,
    "avg_prompts_per_active_user": 14.0,
    "signups": 5,
    "feedback_count": 2,
    "feedback_avg_rating": 4.5
  },
  "daily": [
    {
      "day": "2026-05-01",
      "prompts": 5,
      "assistant_messages": 5,
      "active_users": 2,
      "conversations_touched": 2
    }
  ]
}
```

Product metrics are computed from Supabase `messages`, `conversations`, `auth.users`, and `feedback`. You can also query `analytics.daily_metrics` directly in the Supabase SQL Editor.

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
