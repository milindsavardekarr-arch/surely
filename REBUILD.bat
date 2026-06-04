@echo off
echo =====================================================
echo  SURELY - FORCE REBUILD
echo  This clears old Docker cache and rebuilds fresh.
echo  Takes 5-10 minutes. Do NOT close this window.
echo =====================================================
echo.

echo [1/4] Stopping all containers...
docker compose down --remove-orphans

echo.
echo [2/4] Removing old images...
for /f "tokens=*" %%i in ('docker images --filter "reference=*surely*" -q') do docker rmi -f %%i 2>nul
for /f "tokens=*" %%i in ('docker images --filter "reference=*v12*" -q') do docker rmi -f %%i 2>nul

echo.
echo [3/4] Building fresh (no cache)...
docker compose build --no-cache

echo.
echo [4/4] Starting...
docker compose up -d

echo.
echo =====================================================
echo  Done! Open http://localhost:3000
echo  Check logs: docker compose logs -f backend
echo =====================================================
pause
