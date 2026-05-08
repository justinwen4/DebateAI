FROM python:3.11-slim
WORKDIR /app
COPY . .
RUN pip install --no-cache-dir -r backend/requirements.txt
CMD cd backend && uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
