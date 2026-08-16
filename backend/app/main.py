"""AutoData - FastAPI backend.

Exposes the data processing engine and the AI layer over HTTP so the frontend
can consume them. The app runs fully locally; an LLM API key is optional.

Highlights:
- Async upload jobs with real progress (POST /api/jobs/upload).
- Sync upload retained for scripting/tests (POST /api/datasets).
- Export of the current (possibly cleaned) dataset as CSV or XLSX.
- Reports in Markdown, HTML and PDF.
- Cleaning pipeline with history + undo.
"""

from __future__ import annotations

import io
import json
import logging
import tempfile
import threading
import time
import traceback
import uuid

from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from . import config
from .ai import generate_insights, nlu
from .data_engine import preview_rows, rows_slice
from .data_engine.loader import DataLoadError, load_dataframe
from .report import build_report_html, build_report_markdown, build_report_pdf
from .security import RateLimitMiddleware
from .sessions.store import store

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("autodata")

SAMPLE_DATA_DIR = Path(__file__).resolve().parents[2] / "sample_data"

SAMPLE_CATALOG = [
    {
        "name": "sales_data",
        "title": "Retail sales",
        "description": "1,201 orders with revenue, regions, channels and product categories. Includes deliberately injected quality issues to explore.",
        "file": "sales_data.csv",
        "file_type": ".csv",
        "tags": ["retail", "time series", "categories"],
    },
    {
        "name": "customer_churn",
        "title": "Customer churn",
        "description": "1,501 telecom customers with plans, contracts, usage and churn outcomes — ideal for classification-style exploration.",
        "file": "customer_churn.csv",
        "file_type": ".csv",
        "tags": ["telecom", "categories", "target"],
    },
    {
        "name": "web_traffic",
        "title": "Web traffic",
        "description": "365 days of marketing metrics with a clear trend and weekly seasonality — perfect for time-series analysis.",
        "file": "web_traffic.csv",
        "file_type": ".csv",
        "tags": ["marketing", "time series", "seasonality"],
    },
]

app = FastAPI(title="AI Data Analyst", version="2.0.0")

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


class _JobStore:
    """In-memory registry of analysis jobs (status, stage, progress, result)."""

    def __init__(self):
        self._jobs: dict[str, dict] = {}
        self._lock = threading.Lock()

    def create(self, name: str) -> str:
        job_id = uuid.uuid4().hex
        with self._lock:
            self._jobs[job_id] = {
                "id": job_id,
                "name": name,
                "status": "queued",
                "stage": "validating",
                "progress": 0,
                "message": "Waiting to start",
                "error": None,
                "session_id": None,
            }
        return job_id

    def update(self, job_id: str, **fields) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is not None:
                job.update(fields)

    def get(self, job_id: str) -> dict | None:
        with self._lock:
            job = self._jobs.get(job_id)
            return dict(job) if job else None


jobs = _JobStore()


def _validate_upload(filename: str, data: bytes) -> None:
    """Shared validation for file uploads.

    Checks both file extension (against ``config.ALLOWED_EXTENSIONS``) and
    file size (against ``config.MAX_UPLOAD_BYTES``).  Raises
    :class:`~fastapi.HTTPException` with a descriptive 400 message on failure.
    """
    ext = Path(filename).suffix.lower()
    if ext not in config.ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(config.ALLOWED_EXTENSIONS))
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported file type '{ext}'. "
                f"Allowed types: {allowed}"
            ),
        )
    if len(data) > config.MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"File is too large ({len(data) / (1024 * 1024):.1f} MB). "
                f"Maximum allowed size is {config.MAX_UPLOAD_MB} MB."
            ),
        )


def _get_session_or_404(session_id: str):
    session = store.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Dataset session not found or expired.")
    return session


def _snapshot(session_id: str) -> dict:
    session = _get_session_or_404(session_id)
    engine = session.engine
    snapshot = {
        "dataset": {
            "id": session.id,
            "name": session.name,
            "rows": engine.summary["row_count"],
            "columns": engine.summary["column_count"],
            "created_at": session.created_at,
            "last_access": session.last_access,
            "file_size": session.file_size,
            "file_type": session.file_type,
            "favorite": session.favorite,
            "preview": preview_rows(engine.df),
        },
        "summary": engine.summary,
        "columns": engine.columns,
        "quality": engine.quality,
        "charts": engine.chart_suggestions,
    }
    snapshot["dataset"]["quality_score"] = engine.quality["summary"]["quality_score"]
    return snapshot


def _run_analysis_job(job_id: str, data: bytes, filename: str, sheet_name: str | None) -> None:
    try:
        jobs.update(job_id, status="running", stage="loading", progress=15,
                    message="Parsing file…")
        df = load_dataframe(data, filename, sheet_name)
        jobs.update(job_id, stage="analyzing", progress=55, message="Profiling columns…")
        from .data_engine import analyze

        engine = analyze(df)
        jobs.update(job_id, stage="building", progress=85, message="Building charts and insights…")
        session = store.create(filename, engine, file_size=len(data), file_type=Path(filename).suffix or "")
        jobs.update(job_id, status="done", stage="done", progress=100,
                    message="Analysis complete", session_id=session.id)
    except DataLoadError as exc:
        jobs.update(job_id, status="error", error=str(exc))
    except Exception as exc:  # noqa: BLE001
        logger.exception("Analysis job %s failed", job_id)
        jobs.update(job_id, status="error", error=f"Analysis failed: {exc}")


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


@app.post("/api/jobs/upload")
async def create_upload_job(
    file: UploadFile = File(...),
    sheet_name: str | None = Form(default=None),
):
    if file.filename is None:
        raise HTTPException(status_code=400, detail="No file name provided.")
    data = await file.read()
    _validate_upload(file.filename, data)
    job_id = jobs.create(file.filename)
    thread = threading.Thread(
        target=_run_analysis_job, args=(job_id, data, file.filename, sheet_name), daemon=True
    )
    thread.start()
    return {"job_id": job_id, "name": file.filename}


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    return job


@app.post("/api/datasets")
async def upload_dataset(
    file: UploadFile = File(...),
    sheet_name: str | None = Form(default=None),
):
    if file.filename is None:
        raise HTTPException(status_code=400, detail="No file name provided.")
    data = await file.read()
    _validate_upload(file.filename, data)
    try:
        df = load_dataframe(data, file.filename, sheet_name)
    except DataLoadError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    from .data_engine import analyze

    engine = analyze(df)
    session = store.create(file.filename, engine, file_size=len(data),
                           file_type=Path(file.filename).suffix or "")
    return _snapshot(session.id)


@app.post("/api/datasets/sample")
def upload_sample_dataset(name: str = "sales_data"):
    entry = next((s for s in SAMPLE_CATALOG if s["name"] == name), None)
    if entry is None:
        raise HTTPException(status_code=400, detail=f"Unknown sample dataset '{name}'.")
    path = SAMPLE_DATA_DIR / entry["file"]
    try:
        data = path.read_bytes()
        df = load_dataframe(data, path.name)
    except DataLoadError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except OSError as exc:
        raise HTTPException(status_code=500, detail="Sample data not available.") from exc

    from .data_engine import analyze

    engine = analyze(df)
    session = store.create(path.name, engine, file_size=len(data), file_type=".csv")
    return _snapshot(session.id)


@app.get("/api/samples")
def list_samples():
    catalog = []
    for entry in SAMPLE_CATALOG:
        path = SAMPLE_DATA_DIR / entry["file"]
        size = path.stat().st_size if path.exists() else 0
        catalog.append({**entry, "size": size})
    return {"samples": catalog}


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


class UpdateDatasetRequest(BaseModel):
    name: str | None = None
    favorite: bool | None = None


@app.patch("/api/datasets/{session_id}")
def update_dataset(session_id: str, request: UpdateDatasetRequest):
    session = _get_session_or_404(session_id)
    try:
        if request.name is not None:
            updated = store.rename(session.id, request.name)
            if updated is None:
                raise HTTPException(status_code=404, detail="Dataset session not found.")
        if request.favorite is not None:
            updated = store.set_favorite(session.id, request.favorite)
            if updated is None:
                raise HTTPException(status_code=404, detail="Dataset session not found.")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"session": next(
        (s for s in store.list_sessions() if s["id"] == session.id), None
    )}


@app.post("/api/datasets/{session_id}/duplicate")
def duplicate_dataset(session_id: str):
    dup = store.duplicate(session_id)
    if dup is None:
        raise HTTPException(status_code=404, detail="Dataset session not found.")
    return _snapshot(dup.id)


@app.get("/api/datasets/{session_id}/overview")
def get_overview(session_id: str):
    return _snapshot(session_id)


@app.get("/api/datasets/{session_id}/rows")
def get_rows(session_id: str, offset: int = 0, limit: int = 100):
    session = _get_session_or_404(session_id)
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


@app.get("/api/datasets/{session_id}/export")
def export_dataset(session_id: str, fmt: str = "csv"):
    session = _get_session_or_404(session_id)
    base = ".".join(session.name.rsplit(".", 1)[:-1]) if "." in session.name else session.name
    base = base or "dataset"
    if fmt == "csv":
        buf = io.StringIO()
        session.engine.df.to_csv(buf, index=False)
        content = buf.getvalue().encode("utf-8")
        media_type = "text/csv; charset=utf-8"
        filename = f"{base}-cleaned.csv"
    elif fmt == "xlsx":
        buf = io.BytesIO()
        with pd_writer(buf) as writer:
            session.engine.df.to_excel(writer, index=False, sheet_name="data")
        content = buf.getvalue()
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"{base}-cleaned.xlsx"
    else:
        raise HTTPException(status_code=400, detail="fmt must be 'csv' or 'xlsx'.")
    return StreamingResponse(
        io.BytesIO(content),
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={json.dumps(filename)}"},
    )


def pd_writer(buf: io.BytesIO):
    """Context manager for pandas ExcelWriter (compat across pandas versions)."""
    import pandas as pd

    return pd.ExcelWriter(buf, engine="openpyxl")


@app.post("/api/datasets/{session_id}/clean")
def clean_dataset(session_id: str, request: CleanRequest):
    session = _get_session_or_404(session_id)
    params: dict = {}
    if request.column is not None:
        params["column"] = request.column
    if request.value is not None:
        params["value"] = request.value
    try:
        engine, description = session.apply_clean(request.action, params)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    engine.invalidate()
    store.persist(session)
    snapshot = _snapshot(session.id)
    snapshot["cleaning"] = {"description": description, "history_length": len(session.history)}
    return snapshot


@app.post("/api/datasets/{session_id}/clean/undo")
def undo_clean(session_id: str):
    session = _get_session_or_404(session_id)
    restored = session.undo_clean()
    if restored is None:
        return {"ok": True, "undone": False}
    _engine, description = restored
    store.persist(session)
    snapshot = _snapshot(session.id)
    snapshot["cleaning"] = {"description": description, "history_length": len(session.history), "undone": True}
    return snapshot


@app.get("/api/datasets/{session_id}/cleaning")
def cleaning_history(session_id: str):
    session = _get_session_or_404(session_id)
    return {"steps": session.cleaning_history(), "length": len(session.history)}


@app.get("/api/datasets/{session_id}/quality")
def get_quality(session_id: str):
    session = _get_session_or_404(session_id)
    return {"quality": session.engine.quality}


@app.get("/api/datasets/{session_id}/charts")
def get_charts(session_id: str):
    session = _get_session_or_404(session_id)
    return {"charts": session.engine.chart_suggestions, "correlations": session.engine.correlations}


@app.get("/api/datasets/{session_id}/insights")
def get_insights(session_id: str):
    session = _get_session_or_404(session_id)
    return {"insights": session.engine.cached_insights()}


@app.post("/api/datasets/{session_id}/insights/generate")
def regenerate_insights(session_id: str):
    session = _get_session_or_404(session_id)
    session.engine.invalidate()
    return {"insights": session.engine.cached_insights()}


@app.get("/api/datasets/{session_id}/suggested-questions")
def suggested_questions(session_id: str):
    session = _get_session_or_404(session_id)
    return {"questions": nlu.suggested_questions(session.engine)}


@app.post("/api/datasets/{session_id}/ask")
def ask_question(session_id: str, request: AskRequest):
    session = _get_session_or_404(session_id)
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")
    try:
        result = nlu.answer(request.question.strip(), session.engine, memory=session.conversation)
    except Exception as exc:  # noqa: BLE001 - always return a graceful answer
        logger.exception("Question failed for session %s", session_id)
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
    store.persist(session)
    return result


@app.get("/api/datasets/{session_id}/report")
def get_report(session_id: str, fmt: str = "markdown"):
    session = _get_session_or_404(session_id)
    insights = session.engine.cached_insights()
    if fmt == "pdf":
        pdf = build_report_pdf(session.engine, session.name, insights)
        base = ".".join(session.name.rsplit(".", 1)[:-1]) if "." in session.name else session.name
        return StreamingResponse(
            io.BytesIO(pdf),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={json.dumps(base + '-report.pdf')}"},
        )
    md = build_report_markdown(session.engine, session.name, insights)
    if fmt == "html":
        return {"format": "html", "content": build_report_html(session.engine, session.name, insights), "markdown": md}
    return {"format": "markdown", "content": md, "markdown": md}


@app.get("/api/datasets/{session_id}/conversation")
def get_conversation(session_id: str):
    """Return the stored analyst conversation so it can be restored client-side."""
    session = _get_session_or_404(session_id)
    return {"conversation": session.conversation}


@app.get("/api/datasets/{session_id}/executive-summary")
def get_executive_summary(session_id: str):
    """Rule-based executive analytics: overview, KPIs, takeaways, recommendations."""
    session = _get_session_or_404(session_id)
    from .ai.executive import build_executive_summary

    return build_executive_summary(session.engine)


@app.get("/api/datasets/{session_id}/advanced-charts")
def get_advanced_charts(session_id: str):
    """Advanced chart specs plus intelligent recommendations for the data."""
    session = _get_session_or_404(session_id)
    from .data_engine.advanced_charts import build_advanced_charts, build_chart_recommendations

    return {
        "charts": build_advanced_charts(session.engine),
        "recommendations": build_chart_recommendations(session.engine),
    }


@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "An unexpected error occurred."})
