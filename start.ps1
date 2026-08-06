Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $root

if (-not (Test-Path ".venv")) {
    python -m venv .venv
}

$activate = Join-Path $root ".venv\Scripts\Activate.ps1"
if (-not (Test-Path $activate)) {
    throw "Virtual environment activation script not found: $activate"
}

. $activate
pip install -q -r backend\requirements.txt

Write-Host "Starting backend..."
Start-Process -NoNewWindow -WorkingDirectory "$root\backend" -FilePath python -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"

Write-Host "Starting frontend..."
Start-Process -NoNewWindow -WorkingDirectory "$root\frontend" -FilePath npm -ArgumentList "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "5173"

Write-Host "AI Data Analyst is starting."
Write-Host "Frontend: http://localhost:5173"
Write-Host "Backend: http://localhost:8000/api/health"

Pop-Location
