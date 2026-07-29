@echo off
echo ===== AI-Powered CRM Backend Startup =====
echo.

cd /d "%~dp0backend"

REM Reset the local SQLite database only when explicitly requested.
if /I "%RESET_DB%"=="1" (
    echo Resetting local SQLite database...
    if exist crm_local.db del /f crm_local.db
    if exist crm_local.db-shm del /f crm_local.db-shm
    if exist crm_local.db-wal del /f crm_local.db-wal
) else (
    echo Keeping existing local SQLite database. Set RESET_DB=1 to reset it.
)

REM Check if venv exists, create if not
if not exist "venv" (
    echo Creating Python virtual environment...
    python -m venv venv
)

REM Activate venv and install dependencies
call venv\Scripts\activate.bat
echo Installing Python dependencies...
pip install -r requirements.txt

echo.
echo Starting FastAPI backend on http://127.0.0.1:8000 ...
echo Credentials: admin@crm.com / Admin123!
echo.
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
