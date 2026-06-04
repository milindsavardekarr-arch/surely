# 🤖 WhatsApp Relationship AI

> AI-powered customer relationship management via WhatsApp status monitoring. Detect life events, generate personalized replies, and strengthen customer bonds — automatically.

![Tech Stack](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![Tech Stack](https://img.shields.io/badge/Node.js-20-green?logo=node.js)
![Tech Stack](https://img.shields.io/badge/PostgreSQL-16-blue?logo=postgresql)
![Tech Stack](https://img.shields.io/badge/Redis-7-red?logo=redis)
![Tech Stack](https://img.shields.io/badge/OpenAI-GPT--4o--mini-purple?logo=openai)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔐 **Business Auth** | JWT-based multi-tenant authentication |
| 📱 **WhatsApp Web** | QR code login, persistent sessions via Playwright |
| 👥 **CRM Module** | Full contact management + CSV import |
| 👁️ **Status Monitor** | Auto-scrape WhatsApp statuses |
| 🧠 **Event Detection** | Keyword-based birthday/achievement/emotion detection |
| 🤖 **AI Replies** | GPT-4o-mini personalized reply generation |
| ✅ **Approval Workflow** | Review, edit, or reject before sending |
| 📊 **Analytics** | Engagement metrics and event breakdown |

---

## 🏗️ Architecture

```
whatsapp-relationship-ai/
├── backend/               # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── config/        # DB, Redis configuration
│   │   ├── controllers/   # Route handlers
│   │   ├── middleware/    # Auth, error handling
│   │   ├── queues/        # BullMQ workers
│   │   ├── routes/        # Express routers
│   │   ├── services/
│   │   │   ├── ai/        # OpenAI + event detection
│   │   │   └── automation/ # Playwright WhatsApp automation
│   │   └── utils/         # Logger, auth, encryption
│   └── prisma/            # Database schema + migrations
├── frontend/              # Next.js 14 + Tailwind
│   └── src/
│       ├── app/
│       │   ├── auth/      # Login, Signup pages
│       │   └── dashboard/ # All dashboard pages
│       ├── components/    # Shared UI components
│       └── lib/           # API client, Zustand store
└── docker-compose.yml     # Full stack orchestration
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- OpenAI API key

### 1. Clone & Install

```bash
git clone <repo-url>
cd whatsapp-relationship-ai

# Install backend deps
cd backend && npm install

# Install frontend deps
cd ../frontend && npm install
```

### 2. Configure Environment

```bash
# Backend
cd backend
cp .env.example .env
# Edit .env with your values (DB, Redis, OpenAI key, JWT secret)

# Frontend
cd ../frontend
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 3. Database Setup

```bash
cd backend

# Run migrations
npx prisma migrate dev --name init

# (Optional) Open Prisma Studio
npx prisma studio
```

### 4. Start Development

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Visit: http://localhost:3000

---

## 🐳 Docker Setup

```bash
# Copy and configure root .env
cp .env.docker.example .env

# Edit .env:
# POSTGRES_PASSWORD=yourpassword
# JWT_SECRET=your-super-secret-32-char-key
# SESSION_ENCRYPTION_KEY=your-32-char-encryption-key!
# OPENAI_API_KEY=sk-your-key
# FRONTEND_URL=http://localhost:3000

# Launch everything
docker-compose up -d

# Run migrations
docker-compose exec backend npx prisma migrate deploy

# View logs
docker-compose logs -f backend
```

---

## 🔌 API Reference

### Authentication
```
POST /api/auth/signup      # Create account + business
POST /api/auth/login       # Get JWT token
GET  /api/auth/me          # Current user profile
POST /api/auth/business-accounts  # Add business
```

### WhatsApp Sessions
```
GET    /api/sessions                    # List sessions
POST   /api/sessions                    # Create + get QR code
GET    /api/sessions/:id                # Session status
DELETE /api/sessions/:id                # Disconnect
POST   /api/sessions/scrape             # Trigger status scrape
```

### CRM Contacts
```
GET    /api/contacts                    # List (search, filter, paginate)
POST   /api/contacts                    # Create contact
GET    /api/contacts/:id                # Get with history
PUT    /api/contacts/:id                # Update
DELETE /api/contacts/:id                # Delete
POST   /api/contacts/import             # CSV import (multipart)
```

### Status Monitoring
```
GET /api/statuses                       # List detected statuses
```

### AI Replies
```
GET  /api/replies                       # List replies (filter by status)
POST /api/replies/:id/approve           # Approve (+ optional editedText)
POST /api/replies/:id/reject            # Reject
POST /api/replies/:id/regenerate        # Regenerate with AI
```

### Analytics
```
GET /api/analytics/dashboard            # Full dashboard stats
GET /api/analytics/contacts/engagement  # Top engaged contacts
```

---

## 📋 Queue Architecture

| Queue | Purpose | Concurrency |
|---|---|---|
| `status-processing` | Detect events in statuses | 5 |
| `ai-reply-generation` | Call OpenAI for replies | 3 |
| `whatsapp-send` | Send via Playwright | 2 |
| `status-scraping` | Scrape WA Web statuses | 1 |

---

## 🗄️ Database Schema

```
users → business_accounts → whatsapp_sessions
                          → contacts → statuses → ai_replies
                                     → engagement_logs
```

---

## 🔑 Required Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection URL |
| `JWT_SECRET` | Min 32 chars, secret for JWT signing |
| `SESSION_ENCRYPTION_KEY` | 32 chars, for WhatsApp session encryption |
| `OPENAI_API_KEY` | Your OpenAI API key |

---

## 🔮 Future Roadmap

- [ ] Multi-agent support (assign to team members)
- [ ] AI sentiment analysis (beyond keywords)
- [ ] Auto campaigns (scheduled outreach)
- [ ] WhatsApp Business API integration
- [ ] Role-based access control
- [ ] Webhook notifications
- [ ] Contact birthday auto-detection
- [ ] Bulk reply campaigns

---

## ⚠️ Important Notes

1. **WhatsApp ToS**: Use responsibly. This is for legitimate business relationship management.
2. **Session Security**: Sessions are AES-encrypted at rest.
3. **Rate Limiting**: API is rate-limited (100 req/15min general, 10 req/15min auth).
4. **Playwright**: Runs headless Chromium — ensure sufficient RAM (512MB+).

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, Tailwind CSS, React Query, Zustand, Framer Motion, Recharts
- **Backend**: Node.js, Express, TypeScript, Prisma ORM
- **Database**: PostgreSQL 16
- **Queue**: BullMQ + Redis
- **AI**: OpenAI GPT-4o-mini
- **Automation**: Playwright (Chromium)
- **Auth**: JWT + bcrypt
- **Security**: Helmet, CORS, rate-limiting, AES session encryption

---

Made with ❤️ for building better customer relationships
