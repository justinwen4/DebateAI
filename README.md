# DebateAI — Debate Analytics Assistant

A chatbot that generates high-quality, natural-sounding debate analytics in the style of competitive debaters. Dense reasoning, fluid prose, zero bullet points.

## Stack

| Layer    | Tech                                |
|----------|-------------------------------------|
| Frontend | Next.js 15, TypeScript, TailwindCSS |
| Backend  | FastAPI, Python                     |
| LLM      | OpenAI API (gpt-4o-mini)           |
| RAG      | ChromaDB (local vector store)       |
| Training | LoRA fine-tuning scaffold (Phase 2) |

## Quick Start

### 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add your OpenAI key
uvicorn main:app --reload
```

The API runs at `http://localhost:8000`. On startup it seeds the vector store from `ml/dataset.jsonl`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## API

**POST /generate**

```json
{ "prompt": "Why does fairness outweigh education?" }
```

```json
{ "output": "Fairness outweighs—it's a gateway issue..." }
```

## Project Structure

```
/backend
  main.py              # FastAPI app
  services/
    llm.py             # OpenAI abstraction (swap for local model later)
    rag.py             # ChromaDB retrieval
/frontend              # Next.js chat UI
/ml
  dataset.jsonl        # debate training data
  train.py             # LoRA fine-tuning scaffold
```

## Roadmap

- [x] Chat UI
- [x] OpenAI-powered generation
- [x] RAG with debate analytics corpus
- [ ] LoRA fine-tuned LLaMA model
- [ ] Expanded dataset
- [ ] Production deployment
