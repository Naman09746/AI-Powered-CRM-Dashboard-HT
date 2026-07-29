@echo off
echo ===== Restart CRM Backend =====
echo.

echo [1/3] Stopping old backend process on port 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000"') do (
    echo Terminating PID %%a
    taskkill /F /PID %%a
)

cd /d "%~dp0backend"

if not exist "venv" (
    echo [2/3] Creating Python virtual environment...
    python -m venv venv
)

call venv\Scripts\activate.bat
echo [3/3] Installing Python dependencies...
pip install -r requirements.txt

echo.
echo Starting FastAPI backend on http://127.0.0.1:8000 ...
echo.
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
