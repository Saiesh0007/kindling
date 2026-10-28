@echo off
REM Kindling - one-click start. First run installs everything (needs internet once).
setlocal
set ROOT=%~dp0

cd /d "%ROOT%backend"
if not exist .venv (
  echo Setting up Python environment...
  py -3.11 -m venv .venv 2>nul || py -3.12 -m venv .venv 2>nul || python -m venv .venv
)
.venv\Scripts\python -m pip install -q --disable-pip-version-check -r requirements.txt
if not exist .models (
  echo Downloading the small embedding model, about 90 MB, once...
  .venv\Scripts\python -m app.prefetch
)

cd /d "%ROOT%web"
if not exist node_modules (
  echo Installing web dependencies...
  call npm install
)
if not exist dist\index.html call npm run build
if not exist "%ROOT%extension\panel\index.html" call npm run build:ext

cd /d "%ROOT%backend"
echo.
echo  Kindling is running at http://127.0.0.1:8000
echo  Press Ctrl+C to stop.
echo.
start "" http://127.0.0.1:8000
.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
