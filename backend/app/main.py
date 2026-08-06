"""AutoData - FastAPI backend.

Exposes the data processing engine and the AI layer over HTTP so the frontend
can consume them. The app runs fully locally; an LLM API key is optional.
"""

from __future__ import annotations

import json
import os
import tempfile
import time
import traceback

from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import config
from .ai import generate_insights, nlu
from .data_engine import preview_rows, rows_slice
from .data_engine.loader import DataLoadError, load_dataframe
from .report import build_report_markdown, markdown_to_html
from .security import RateLimitMiddleware
from .sessions.store import store

SAMPLE_DATA_PATH = Path(__file__).resolve().parents[2] / "sample_data" / "sales_data.csv"

app = FastAPI(title="AI Data Analyst", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware)


class AskRequest(BaseModel):
    question: str


class CleanRequest(BaseModel):
    action: str
    column: str | None = None
    value: str | int | float | None = None


def _snapshot(session_id: str) -> dict:
    session = store.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Dataset session not found or expired.")
    engine = session.engine
    snapshot = {
        "dataset": {
            "id": session.id,
            "name": session.name,
            "rows": engine.summary["row_count"],
            "columns": engine.summary["column_count"],
            "created_at": session.created_at,
            "preview": preview_rows(engine.df),
        },
        "summary": engine.summary,
        "columns": engine.columns,
        "quality": engine.quality,
        "charts": engine.chart_suggestions,
    }
    snapshot["dataset"]["quality_score"] = engine.quality["summary"]["quality_score"]
    return snapshot


@app.get("/api/health")
def health():
    return {"status": "ok", "llm_enabled": config.llm_enabled(), "time": time.time()}


@app.get("/api/llm/status")
def llm_status():
    return {
        "enabled": config.llm_enabled(),
        "model": config.USER_LLM_MODEL if config.llm_enabled() else None,
        "base_url": config.USER_LLM_BASE_URL if config.llm_enabled() else None,
        "mode": "llm" if config.llm_enabled() else "local",
    }


@app.post("/api/datasets")
async def upload_dataset(
    file: UploadFile = File(...),
    sheet_name: str | None = Form(default=None),
):
    if file.filename is None:
        raise HTTPException(status_code=400, detail="No file name provided.")
    data = await file.read()
    try:
        df = load_dataframe(data, file.filename, sheet_name)
    except DataLoadError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    from .data_engine import analyze

    engine = analyze(df)
    session = store.create(file.filename, engine)
    return _snapshot(session.id)


@app.post("/api/datasets/sample")
def upload_sample_dataset():
    try:
        data = SAMPLE_DATA_PATH.read_bytes()
        df = load_dataframe(data, SAMPLE_DATA_PATH.name)
    except DataLoadError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except OSError as exc:
        raise HTTPException(status_code=500, detail="Sample data not available.") from exc

    from .data_engine import analyze

    engine = analyze(df)
    session = store.create(SAMPLE_DATA_PATH.name, engine)
    return _snapshot(session.id)


@app.get("/api/datasets/{session_id}")
def get_dataset(session_id: str):
    return _snapshot(session_id)


@app.get("/api/datasets")
def list_datasets():
    return {"datasets": store.list_sessions()}


@app.delete("/api/datasets/{session_id}")
def delete_dataset(session_id: str):
    if not store.delete(session_id):
        raise HTTPException(status_code=404, detail="Dataset session not found.")
    return {"ok": True}


@app.get("/api/datasets/{session_id}/overview")
def get_overview(session_id: str):
    return _snapshot(session_id)


@app.get("/api/datasets/{session_id}/rows")
def get_rows(session_id: str, offset: int = 0, limit: int = 100):
    session = store.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Dataset session not found or expired.")
    if offset < 0 or limit < 1 or limit > 1000:
        raise HTTPException(status_code=400, detail="offset >= 0 and 1 <= limit <= 1000 required.")
    total = len(session.engine.df)
    rows = rows_slice(session.engine.df, offset=offset, limit=limit)
    return {
        "offset": offset,
        "limit": limit,
        "total": total,
        "columns": [c["name"] for c in session.engine.columns],
        "rows": rows,
    }


@app.post("/api/datasets/{session_id}/clean")
def clean_dataset(session_id: str, request: CleanRequest):
    session = store.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Dataset session not found or expired.")
    params: dict = {}
    if request.column is not None:
        params["column"] = request.column
    if request.value is not None:
        params["value"] = request.value
    try:
        engine, description = session.apply_clean(request.action, params)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    snapshot = _snapshot(session.id)
    snapshot["cleaning"] = {"description": description, "history_length": len(session.history)}
    return snapshot


@app.post("/api/datasets/{session_id}/clean/undo")
def undo_clean(session_id: str):
    session = store.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Dataset session not found or expired.")
    restored = session.undo_clean()
    if restored is None:
        return {"ok": True, "undone": False}
    _engine, description = restored
    snapshot = _snapshot(session.id)
    snapshot["cleaning"] = {"description": description, "history_length": len(session.history), "undone": True}
    return snapshot


@app.get("/api/datasets/{session_id}/quality")
def get_quality(session_id: str):
    session = store.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Dataset session not found or expired.")
    return {"quality": session.engine.quality}


@app.get("/api/datasets/{session_id}/charts")
def get_charts(session_id: str):
    session = store.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Dataset session not found or expired.")
    return {"charts": session.engine.chart_suggestions, "correlations": session.engine.correlations}


@app.get("/api/datasets/{session_id}/insights")
def get_insights(session_id: str):
    session = store.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Dataset session not found or expired.")
    insights = generate_insights(session.engine)
    return {"insights": insights}


@app.post("/api/datasets/{session_id}/insights/generate")
def regenerate_insights(session_id: str):
    session = store.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Dataset session not found or expired.")
    insights = generate_insights(session.engine)
    return {"insights": insights}


@app.post("/api/datasets/{session_id}/ask")
def ask_question(session_id: str, request: AskRequest):
    session = store.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Dataset session not found or expired.")
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")
    try:
        result = nlu.answer(request.question.strip(), session.engine, memory=session.conversation)
    except Exception as exc:  # noqa: BLE001 - always return a graceful answer
        traceback.print_exc()
        result = {
            "answer": f"Sorry, something went wrong while answering ({(type(exc).__name__)}: {exc}). "
                      "Please rephrase your question.",
            "numbers": [],
            "explanation": "The analyst engine raised an error.",
            "mode": "error",
            "sql": None,
            "chart": None,
        }
    session.conversation.append({"role": "user", "content": request.question.strip()})
    session.conversation.append(
        {"role": "assistant", "content": result.get("answer", ""), "intent": result.get("intent")}
    )
    if len(session.conversation) > 20:
        session.conversation = session.conversation[-20:]
    return result


@app.get("/api/datasets/{session_id}/report")
def get_report(session_id: str, fmt: str = "markdown"):
    session = store.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Dataset session not found or expired.")
    insights = generate_insights(session.engine)
    md = build_report_markdown(session.engine, session.name, insights)
    if fmt == "html":
        return {"format": "html", "content": markdown_to_html(md), "markdown": md}
    return {"format": "markdown", "content": md, "markdown": md}
