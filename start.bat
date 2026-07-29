@echo off
echo ===== AI-Powered CRM Dashboard — Full Startup =====
echo.
echo Closing any previous backend server running on port 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000"') do (
    echo Terminating old server process PID %%a...
    taskkill /F /T /PID %%a
)

cd /d "%~dp0backend"

if /I "%RESET_DB%"=="1" (
    if exist crm_local.db del /f crm_local.db
    if exist crm_local.db-shm del /f crm_local.db-shm
    if exist crm_local.db-wal del /f crm_local.db-wal
    echo [OK] Local database reset.
) else (
    echo [OK] Keeping existing local database. Set RESET_DB=1 to reset it.
)

if not exist "venv" (
    echo [SETUP] Creating Python virtual environment...
    python -m venv venv
)
call venv\Scripts\activate.bat
echo [SETUP] Installing Python dependencies...
pip install -r requirements.txt

echo [START] Launching backend server (port 8000)...
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
