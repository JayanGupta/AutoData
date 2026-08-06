# AutoData

A production-style, locally-runnable AutoData SaaS application. Upload a CSV or Excel file and get instant data profiling, quality checks, interactive visualizations, natural-language Q&A, AI insights and a downloadable report.

## Features

- **Upload** — CSV / TSV / Excel (.xlsx), up to 50 MB, with encoding & delimiter sniffing
- **Auto-profiling** — column type inference, distributions, statistics, semantic hints
- **Data quality** — missing values, duplicates, outliers, type anomalies, constant/empty columns, skew; with a 0–100 quality score
- **Visualizations** — auto-generated histograms, time series, bar/pie breakdowns, scatter plots and a correlation heatmap
- **AI Analyst chat** — ask questions in plain English; answers are grounded in the actual dataset (never invented)
- **AI insights** — deterministic pattern detection (correlations, trends, top performers, outliers), each linked to its chart evidence
- **Report** — one-click professional report in Markdown or HTML

## Tech stack

| Layer | Tech |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Recharts |
| Backend | Python 3.11, FastAPI, pandas, numpy |
| Storage | In-memory sessions with TTL (nothing persisted, privacy-first) |
| AI | Optional OpenAI-compatible LLM (SQL generation + interpretation); fully functional **local rule-based mode** without a key |

## Architecture

```
frontend/   React SPA (port 5173) — proxies /api → backend
backend/    FastAPI app (port 8000)
  app/
    data_engine/   loader → profiler → quality → analysis → charts
    ai/            insights, nlu (LLM or local), sql_runner, llm_client
    sessions/      in-memory session store
    main.py        REST API
  tests/           stdlib unittest suite
sample_data/       sample sales dataset (CSV + Excel)
```

## Run locally

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

### 2. Frontend (in a second terminal)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — the Vite dev server proxies `/api` to the backend on port 8000.

### 3. Optional: enable the LLM

Copy `backend/.env.example` to `backend/.env`, then fill in your own credentials:

```bash
cp backend/.env.example backend/.env
# edit backend/.env and set:
#   USER_LLM_API_KEY=...
#   USER_LLM_BASE_URL=https://api.deepseek.com/v1
#   USER_LLM_MODEL=deepseek-chat
```

Without a key, the app runs in **local mode**: the AI analyst still answers questions and generates insights using only computed statistics.

### Quick start script

```bash
./start.sh
```

Starts both servers and prints the URL. Stop with `Ctrl+C`.

## API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/datasets` | Upload file → full analysis snapshot |
| `GET` | `/api/datasets/{id}` | Fetch snapshot (overview, quality, charts) |
| `GET` | `/api/datasets/{id}/insights` | Auto-generated insights |
| `POST` | `/api/datasets/{id}/insights/generate` | Re-run insight generation |
| `POST` | `/api/datasets/{id}/ask` | Natural-language question |
| `GET` | `/api/datasets/{id}/report?fmt=html` | Report (markdown or html) |
| `GET` | `/api/llm/status` | LLM availability |

## Tests

```bash
cd backend
python -m unittest tests.test_engine -v
```

## Privacy note

Datasets are held in memory and automatically expired after 2 hours of inactivity. Nothing is written to disk or shared.

## Try it with sample data

`sample_data/sales_data.csv` (and `.xlsx`) is a realistic sales dataset with deliberately injected quality issues — great for exploring every feature.
