# 🖥️ Windows Setup Guide

## Prerequisites
1. **Node.js 18+** — https://nodejs.org
2. **PostgreSQL** — https://www.postgresql.org/download/windows/
3. **Redis** (optional for login/signup) — https://github.com/tporadowski/redis/releases

---

## Quick Start

### Step 1 — Fix Database URL
Edit `backend\.env`:
```
DATABASE_URL=postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/whatsapp_relationship_ai
```
> If you set no password during PostgreSQL install, try: `postgresql://postgres:@localhost:5432/whatsapp_relationship_ai`

### Step 2 — Setup Backend
Open **Command Prompt** in `backend` folder:
```bat
npm install
npx prisma migrate dev --name init
npm run dev
```
✅ Should show: `🚀 Backend running on http://localhost:4000`
✅ Should show: `✅ Database connected`

### Step 3 — Setup Frontend  
Open **another Command Prompt** in `frontend` folder:
```bat
npm install
npm run dev
```
✅ Open: http://localhost:3000 (or 3001 if 3000 is busy)

---

## Common Errors

### `EADDRINUSE: address already in use :::4000`
```bat
:: Kill all node processes
taskkill /F /IM node.exe

:: Then restart
npm run dev
```

### Signup/Login fails — "Network Error"
1. Check backend is running: http://localhost:4000/health
2. Check **debug page**: http://localhost:3001/debug
3. Make sure `frontend\.env.local` has: `NEXT_PUBLIC_API_URL=http://localhost:4000`

### `Can't reach database` / Prisma errors
1. Open **Services** (Win+R → services.msc)
2. Find `postgresql-x64-17` → Right click → Start
3. Run again: `npx prisma migrate dev --name init`

### Frontend on port 3001 but login fails
This is a CORS issue. Two options:
- **Option A**: Kill what's on port 3000, restart frontend
- **Option B**: Add to `backend\.env`: `FRONTEND_URL=http://localhost:3001`

---

## Startup Script
Double-click `START_WINDOWS.bat` — it automatically frees port 4000 and starts both servers.
