@echo off
echo ================================================
echo  WhatsApp Relationship AI - Windows Startup
echo ================================================
echo.

:: Kill anything on port 4000 first
echo [1/4] Freeing port 4000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :4000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo Done.

:: Check PostgreSQL
echo [2/4] Checking PostgreSQL...
pg_isready -h localhost -p 5432 >nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING: PostgreSQL not running. Start it from Services or pgAdmin.
    echo.
)

:: Start backend
echo [3/4] Starting Backend on port 4000...
start "WA Backend" cmd /k "cd /d %~dp0backend && npm run dev"
echo Waiting 5 seconds for backend to start...
timeout /t 5 /nobreak >nul

:: Start frontend
echo [4/4] Starting Frontend...
start "WA Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ================================================
echo  Starting... Open http://localhost:3000
echo  (or http://localhost:3001 if 3000 is in use)
echo  Backend health: http://localhost:4000/health
echo ================================================
pause
