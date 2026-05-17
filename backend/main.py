"""
Entry point for uvicorn.

Run with:
    uvicorn main:app --reload
or (for the Procfile):
    uvicorn main:app --host 0.0.0.0 --port $PORT
"""
from app.main import app  # noqa: F401 — re-exported for uvicorn
