#!/usr/bin/env bash
# Starts the backend and frontend for local development.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Start backend
(
  cd "$ROOT/backend"
  if [ ! -d ".venv" ]; then
    python3 -m venv .venv
  fi
  source .venv/bin/activate
  pip install -q -r requirements.txt
  python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
) &
BACKEND_PID=$!

# Start frontend
(
  cd "$ROOT/frontend"
  npm install --silent
  npm run dev -- -p 5173
) &
FRONTEND_PID=$!

trap 'echo; echo "Stopping servers…"; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true' EXIT INT TERM

echo "AI Data Analyst running:"
echo "  Frontend:  http://localhost:5173"
echo "  Backend:   http://localhost:8000/api/health"
echo "  Press Ctrl+C to stop."
wait
