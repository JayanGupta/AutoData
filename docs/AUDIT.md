# AutoData — Repository Audit & Roadmap

Audited 2026-08-06. Goal: turn AutoData into a genuinely useful, production-quality
AI Data Analyst.

## File-by-file classification

### Backend

| File | Status | Notes |
| --- | --- | --- |
| `app/main.py` | Partial | LLM flow broken by SQL schema mismatch; no jobs/export/PDF APIs; over-fetches snapshot on overview; weak error contract |
| `app/config.py` | Production | Good env-based config |
| `app/security.py` | Production | In-memory rate limiter, fine for single process |
| `app/data_store/storage.py` | Broken | `pickle` of entire `EngineResult` incl. dataframe = RCE risk on unpickle, slow, version-fragile |
| `app/sessions/store.py` | Partial | Depends on pickle; history holds full EngineResults |
| `app/data_engine/loader.py` | Partial | `.xls` advertised but unreadable (openpyxl is xlsx-only); naive encoding/delimiter sniffing |
| `app/data_engine/profiler.py` | Production | Solid type inference; no PII/sensitivity detection |
| `app/data_engine/quality.py` | Production | Works; score is flat-deduction but functional |
| `app/data_engine/analysis.py` | Production | Solid |
| `app/data_engine/charts.py` | Production | Solid |
| `app/data_engine/cleaning.py` | Partial | Only 4 ops; no fill-mean/median, per-column drop, type cast, text ops |
| `app/data_engine/engine.py` | Production | No insight caching; recomputed every call |
| `app/ai/llm_client.py` | Production | Minimal but works |
| `app/ai/nlu.py` | **Broken** | Schema context uses real column names but SQLite table only has `c0..cn` aliases → LLM SQL always fails, silently falls back to local |
| `app/ai/sql_runner.py` | Partial | Safe, but alias mapping is what breaks the LLM flow |
| `app/ai/local_analyst.py` | Production | Limited regex intents, English-only |
| `app/ai/insights.py` | Partial | Non-thread-safe module counter; recomputed every call |
| `app/report.py` | Partial | Hand-rolled markdown→HTML is crude; no PDF |
| `tests/*` | Partial | ~20 tests, no API/end-to-end coverage |

### Frontend

| File | Status | Notes |
| --- | --- | --- |
| `app/page.tsx`, `dashboard/page.tsx` | Partial | SPA-style tabs; hardcoded placeholder data on dashboard |
| `src/views/Landing.tsx` | **Fake** | Fabricated stats ("1.2K+ datasets", "+18% ROI", "99.9%", "SaaS MVP"), fake "Coming soon — Team collaboration" |
| `src/views/Dashboard.tsx` | Partial | Hardcoded "Today", "CSV / Excel", "Latest refresh: Now" |
| `src/views/DataQuality.tsx` | Partial | Limited cleaning ops exposed; no pipeline history view |
| `src/views/Overview.tsx` | Production | Good |
| `src/views/Analyst.tsx` | Production | Static default suggestions |
| `src/views/Insights.tsx` | Production | Good |
| `src/views/Visualizations.tsx` | Production | Good |
| `src/views/Report.tsx` | Partial | PDF via raw-text jsPDF; no real export |
| `src/components/UploadZone.tsx` | Partial | No client-side size check; no progress; claims 50 MB |
| `src/api/client.ts` | Partial | No timeout/abort |
| `.next/`, `tsconfig.tsbuildinfo`, `app/sessions.db` | Dead | Committed build artifacts + runtime db |

## Product vision

AutoData becomes an AI-native data analysis workspace: upload → auto-profile →
guided cleaning → visual exploration → AI insights & Q&A → polished report/export.
Everything advertised must be real and measurable.

## Prioritized roadmap

### P0 — correctness & trust
1. Fix LLM SQL alias bug so LLM mode actually works.
2. Replace pickle persistence with Parquet + JSON (safe, version-stable).
3. Support `.xls` properly (add `xlrd`) or stop advertising it.
4. Remove committed artifacts (`.next`, `tsconfig.tsbuildinfo`, `sessions.db`).
5. Remove fabricated landing-page stats & "Coming soon" placeholders.
6. Fix `start.sh` port mismatch; fix docker-compose CORS default.

### P1 — core product depth
7. Async upload job API with real progress.
8. Expand cleaning ops + expose pipeline history/undo in UI.
9. Export current (cleaned) dataset as CSV/XLSX.
10. Real server-side PDF report.
11. Insights caching + thread-safe ids.
12. Suggested-questions endpoint for the analyst.
13. PII/sensitivity detection, excluded from LLM context & report.
14. LLM prompt-injection guardrails.

### P2 — polish & hygiene
15. Consistent API error contract + structured logging.
16. Frontend: real loading/error/empty states everywhere; dashboard truthfulness.
17. Backend API tests; frontend lint/typecheck clean.
18. README accuracy; `.gitignore` fixes.
