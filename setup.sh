#!/bin/bash
set -e

echo "🚀 WhatsApp Relationship AI - Setup"
echo "====================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 1. Backend setup
echo -e "\n${YELLOW}📦 Setting up Backend...${NC}"
cd backend

if [ ! -f ".env" ]; then
  cp .env.example .env
  echo -e "${RED}⚠️  Created backend/.env — EDIT IT before continuing (add OPENAI_API_KEY etc.)${NC}"
  echo "Press Enter after editing .env..."
  read
fi

npm install
echo -e "${GREEN}✅ Backend packages installed${NC}"

npx prisma generate
echo -e "${GREEN}✅ Prisma client generated${NC}"

npx prisma migrate dev --name init
echo -e "${GREEN}✅ Database migrated${NC}"

cd ..

# 2. Frontend setup
echo -e "\n${YELLOW}🎨 Setting up Frontend...${NC}"
cd frontend

if [ ! -f ".env.local" ]; then
  cp .env.example .env.local
fi

npm install
echo -e "${GREEN}✅ Frontend packages installed${NC}"

cd ..

echo -e "\n${GREEN}✅ Setup complete!${NC}"
echo ""
echo "To start development:"
echo "  Terminal 1: cd backend && npm run dev"
echo "  Terminal 2: cd frontend && npm run dev"
echo ""
echo "Then open: http://localhost:3000"
