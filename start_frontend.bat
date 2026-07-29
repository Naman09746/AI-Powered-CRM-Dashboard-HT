@echo off
echo ===== AI-Powered CRM Frontend Startup =====
echo.

cd /d "%~dp0frontend"

REM Install npm dependencies if node_modules is missing or stale
if not exist "node_modules" (
    echo Installing Node.js dependencies...
    npm install
)

echo.
echo Starting Vite dev server on http://localhost:5173 ...
echo.
npm run dev
