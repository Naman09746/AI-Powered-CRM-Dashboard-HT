@echo off
echo ===== AI-Powered CRM Dashboard — Reset & Start =====
echo.
echo Stopping old server on port 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000"') do (
    echo Terminating PID %%a...
    taskkill /F /T /PID %%a
)

cd /d "%~dp0backend"

echo Resetting local SQLite database...
if exist crm_local.db del /f /q crm_local.db
if exist crm_local.db-shm del /f /q crm_local.db-shm
if exist crm_local.db-wal del /f /q crm_local.db-wal
echo Database reset complete.

if not exist "venv" (
    echo [SETUP] Creating Python virtual environment...
    python -m venv venv
)
call venv\Scripts\activate.bat
echo [SETUP] Installing Python dependencies...
pip install -r requirements.txt

echo [START] Launching fresh backend server (port 8000)...
start "CRM Backend" cmd /k "cd /d %~dp0backend && call venv\Scripts\activate.bat && uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

echo [START] Launching frontend dev server (port 5173)...
cd /d "%~dp0frontend"
if not exist "node_modules" (
    echo [SETUP] Installing Node.js dependencies...
    call npm install
)
start "CRM Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ===================================================
echo   Backend:  http://127.0.0.1:8000
echo   Frontend: http://localhost:5173
echo.
echo   Login Credentials:
echo     Admin:     admin@crm.com     / Admin123!
echo     Manager:   manager@crm.com   / Manager123!
echo     Executive: exec@crm.com      / Exec123!
echo ===================================================
echo.
pause
