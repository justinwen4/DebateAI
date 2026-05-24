#!/usr/bin/env python3
"""Seed Supabase pgvector from ml/dataset.tutor.jsonl.

Run this after updating the dataset:
    python seed_rag.py          # from the backend/ directory
    python backend/seed_rag.py  # from the repo root
"""
import logging
import os
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(message)s")

# Allow running from repo root or from backend/
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv
load_dotenv(backend_dir / ".env")

from services.rag import seed_from_dataset

count = seed_from_dataset()
if count:
    print(f"\nDone. {count} embeddings live in Supabase.")
else:
    print("\nNothing to do — dataset unchanged or file not found.")
