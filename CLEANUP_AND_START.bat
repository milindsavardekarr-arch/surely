@echo off
echo ========================================
echo  Surely - Clean Start
echo ========================================

echo.
echo [1/3] Stopping and removing old containers...
docker compose down 2>nul
docker rm -f surely_backend surely_frontend surely_postgres surely_redis 2>nul
docker rm -f wrai_backend wrai_frontend wrai_postgres wrai_redis 2>nul

echo.
echo [2/3] Cleaning up orphan networks...
docker network prune -f 2>nul

echo.
echo [3/3] Starting fresh...
docker compose up -d

echo.
echo ========================================
echo  Done! Open http://localhost:3000
echo ========================================
pause
