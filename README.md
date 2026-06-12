# DebateAI — Debate Analytics Assistant

**[debateai.dev](https://debateai.dev)** — live and in use by competitive debaters

> An AI assistant that reasons like an elite debater — dense argumentation, fluid prose, zero bullet points. Built on a private corpus of 1,000+ curated debate analytics documents with real-time SSE streaming and a LoRA fine-tuning scaffold for future model specialization.

**Partnered with 8 national debate organizations · 150+ active users**

### Why it's built differently

| What                                      | How                                                                                                                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RAG over 1,000+ debate analytics docs** | Private JSONL corpus embedded with `text-embedding-3-small`, stored in Supabase pgvector, retrieved per-query to ground every response in real competitive evidence             |
| **SSE streaming**                         | `/generate` streams `text/event-stream` chunks with per-token delivery, usage metadata, and graceful tier-downgrade signalling — no polling, no blocked responses               |
| **LoRA fine-tuning scaffold**             | `ml/train.py` + curated feedback loop (`/feedback` with `curation_eligible` flag) build toward a domain-specialized local model without depending on third-party APIs long-term |
| **Production-grade CI**                   | Pytest · Vitest + typecheck · Playwright E2E smoke (real Supabase auth, mocked SSE) all gated in GitHub Actions; Docker + Railway deploy                                        |

---

## Stack

| Layer    | Tech                                      |
| -------- | ----------------------------------------- |
| Frontend | Next.js 16, TypeScript, TailwindCSS       |
| Backend  | FastAPI, Python                           |
| LLM      | Anthropic API (Claude Sonnet 4.6)         |
| Auth/DB  | Supabase                                  |
| RAG      | Supabase pgvector                         |
| Training | LoRA fine-tuning scaffold (`ml/train.py`) |

## Quick Start

### 1. Backend

The backend is designed to run via Docker/Railway. For local development you can also use a venv:

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add your keys (see below)
uvicorn main:app --reload
```

The API runs at `http://localhost:8000`. On startup it seeds the vector store from `ml/dataset.tutor.jsonl` if present (private dataset, not in git). When the file is absent — e.g. in production — the backend serves from the already-seeded Supabase pgvector data. To (re)seed after editing the dataset, place the file locally and start the backend (or run `python backend/seed_rag.py`) with the target Supabase credentials in `backend/.env`.

**Backend `.env` variables:**

| Variable            | Required | Purpose                                                                                            |
| ------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`      | Yes      | Supabase project URL                                                                               |
| `SUPABASE_KEY`      | Yes      | Supabase **service role** key (DB writes, RAG, metrics)                                            |
| `SUPABASE_ANON_KEY` | Yes      | Supabase **anon** key for `auth.get_user()` token verification; backend refuses to boot without it |
| `OPENAI_API_KEY`    | Yes      | OpenAI embeddings for RAG (`text-embedding-3-small`)                                               |
| `ANTHROPIC_API_KEY` | Yes      | Claude generation                                                                                  |
| `ALLOWED_ORIGINS`   | Yes      | Comma-separated frontend origins (e.g. `http://localhost:3000,https://debateai.dev`)               |
| `ENVIRONMENT`       | No       | Set to `production` on Railway to disable `/docs` and OpenAPI schema (default: `development`)      |
| `ADMIN_API_KEY`     | No       | Secret for `GET /admin/metrics` (optional)                                                         |

See `backend/.env.example` for optional limit/model overrides.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # or create .env.local manually
npm run dev
```

Open `http://localhost:3000`.

**Frontend `.env.local` variables:**

| Variable                        | Required    | Purpose                                                                                             |
| ------------------------------- | ----------- | --------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Yes         | Supabase project URL                                                                                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes         | Supabase anon key (browser auth)                                                                    |
| `NEXT_PUBLIC_API_URL`           | Dev default | Backend URL (defaults to `http://localhost:8000` in development; **required** in production builds) |
| `NEXT_PUBLIC_SITE_URL`          | No          | Canonical site URL for metadata/OG tags (defaults to `https://debateai.dev`)                        |

Example files: `frontend/.env.local.example` (local), `frontend/.env.production.example` (production).

### Supabase email templates (required for signup)

The default Supabase confirmation emails use a PKCE `?code=` link. That fails when users open the link in a different browser or device than where they signed up (the PKCE verifier is stored in cookies during signup).

Update both templates in the [Supabase dashboard](https://supabase.com/dashboard) under **Authentication → Email Templates** so links use `token_hash` instead of `{{ .ConfirmationURL }}`:

**Confirm signup** — replace the confirmation link with:

```html
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/chat">
  Confirm your email
</a>
```

**Reset password** — replace the reset link with:

```html
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">
  Reset password
</a>
```

Also add `https://debateai.dev/auth/callback` (and your local dev URL) to **Authentication → URL Configuration → Redirect URLs**.

## API

All user-facing endpoints require `Authorization: Bearer <supabase_access_token>` unless noted.

### POST /generate — Server-Sent Events (SSE)

Streams the assistant response as `text/event-stream`. Other endpoints return JSON.

**Request** (`application/json`):

```json
{
  "prompt": "Why does fairness outweigh education?",
  "history": [
    { "role": "user", "content": "What is fairness in debate theory?" },
    { "role": "assistant", "content": "Fairness is reciprocal ground..." }
  ]
}
```

**Response** (`Content-Type: text/event-stream`):

Each event is a line `data: <json>` followed by a blank line.

Text chunks as they are generated:

```
data: {"type":"chunk","text":"Fairness outweighs"}

data: {"type":"chunk","text":"—it's a gateway issue..."}
```

Final event with usage metadata:

```
data: {"type":"done","model_tier":"premium","monthly_usage":12,"premium_monthly_limit":30,"notice":null}
```

- `model_tier`: `"premium"` (Sonnet) or `"standard"` (Haiku after monthly cap)
- `monthly_usage`: count after this request was reserved
- `premium_monthly_limit`: Sonnet monthly cap (default 30)
- `notice`: one-time downgrade message when first crossing the cap, otherwise `null`

On server-side generation failure (after streaming started):

```
data: {"type":"error","detail":"Generation failed","status":500}
```

Pre-stream errors (rate limit, auth, validation) return ordinary JSON with the appropriate HTTP status (e.g. `429` for daily limit).

### POST /feedback

```json
{
  "prompt": "Why does fairness outweigh education?",
  "output": "Fairness outweighs...",
  "rating": 3,
  "notes": "Needs a clearer mechanism in sentence two.",
  "curation_eligible": true
}
```

Response: `{"status":"ok"}`

`curation_eligible` should be `true` only for feedback attached to the first user turn in a chat. This keeps follow-up prompts like "can you elaborate?" out of training curation.

### POST /conversations/{conversation_id}/messages

```json
{ "role": "user", "content": "Why does fairness outweigh education?" }
```

Response: `{"status":"ok"}`

### POST /generate-title

```json
{
  "user_message": "Why does fairness outweigh education?",
  "assistant_message": "Fairness outweighs because..."
}
```

Response: `{"title": "Fairness vs Education"}`

### POST /training-request

`multipart/form-data` with `area` (required) and optional `file` attachment.

Response: `{"status":"ok"}`

### GET /admin/metrics (requires `ADMIN_API_KEY`)

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

## Testing

### Backend (pytest)

```bash
cd backend
pip install -r requirements.txt -r requirements-dev.txt
pytest
```

Or inside Docker (matches production):

```bash
docker build -t debateai-test .
docker run --rm debateai-test sh -c 'pip install -r backend/requirements-dev.txt && cd backend && pytest'
```

### Frontend (Vitest + typecheck)

```bash
cd frontend
npm run typecheck
npm run test
```

### End-to-end smoke (Playwright)

Requires a dedicated test user in the Supabase project. Set env vars (locally in `.env.local` or as GitHub Actions secrets):

| Variable                        | Purpose                                                |
| ------------------------------- | ------------------------------------------------------ |
| `E2E_USER_EMAIL`                | Test account email                                     |
| `E2E_USER_PASSWORD`             | Test account password                                  |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL                                   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key                                      |
| `NEXT_PUBLIC_API_URL`           | Backend URL (mocked for `/generate` in the smoke test) |

```bash
cd frontend
npx playwright install chromium
npm run test:e2e
```

The smoke test performs a real Supabase login (required by the server-side session guard) and mocks only the backend `/generate` SSE stream so no Anthropic calls are made. In CI, the e2e job skips gracefully when the secrets above are absent.

## Project Structure

```
/backend
  main.py              # FastAPI app
  services/
    llm.py             # Anthropic generation
    rag.py             # Supabase pgvector retrieval
/frontend              # Next.js chat UI (Supabase auth)
/ml
  dataset.tutor.jsonl  # debate training data (private — local only, seeds the RAG store)
  llm_utils.py         # shared LLM retry helpers
  prompts.py           # rewrite prompts for curation
  train.py             # LoRA fine-tuning scaffold
```

## Deployment

The repo includes a `Dockerfile` and `railway.toml` for Railway deployment.

**Before deploying:** ensure `SUPABASE_ANON_KEY` is set in Railway (backend refuses to boot without it). After the auth migration (localStorage → cookies), users may need to log in again.

## Roadmap

- [x] Chat UI
- [x] Claude-powered generation
- [x] RAG with debate analytics corpus
- [x] Supabase auth and feedback
- [x] Production deployment (Railway)
- [x] LoRA fine-tuned local model
- [x] Expanded dataset
