# Surely v9 — Feature Documentation

## Core Architecture: How Reply Sending Works

Surely uses **Baileys** (WhatsApp Web automation library) to:
1. Maintain a persistent WhatsApp Web session per business account
2. Listen for live status updates from contacts
3. Send replies programmatically — NO separate tab, NO browser automation required

When a reply is sent via `Send Now` or auto-send, it goes:
`Surely backend → Baileys socket → WhatsApp Web protocol → Contact's WhatsApp`

---

## NEW in v9: Intent Detection Engine

### The Problem
A status like "Happy Birthday Ajit 🎂" is ambiguous:
- Who is Ajit? Brother? Friend? Colleague?
- Is the poster celebrating THEIR birthday, or wishing someone else?

### The Solution: Smart Intent Detection
`/backend/src/services/ai/intentDetection.ts`

The engine classifies every status into:

| Intent | Description | Reply Strategy |
|--------|-------------|----------------|
| `SELF_EVENT` | Poster's own birthday/car/marriage etc. | Address poster directly |
| `WISHING_SOMEONE` | Poster is wishing a named third person | Address poster, mention target by name |
| `SELF_EMOTION` | Emotional/sad post | Empathetic, no business talk |
| `GENERAL` | Unclear/generic | Warm generic reply |

### Example
**Status:** "Happy Birthday Ajit! 🎂"
**Intent:** WISHING_SOMEONE → target: Ajit (relation: UNKNOWN)
**Reply:** "Wish Ajit a very very happy birthday from us too! 🎂 Hope he has an amazing day! 🎉"

The system deliberately does NOT guess the relation (friend/sibling/etc.) since it can't know — it just wishes the named person warmly.

---

## NEW in v9: Automation Settings (DB-backed)

### Settings Page (`/dashboard/settings`)
All settings now persist to the `BusinessSettings` database table.

**Automation Modes:**
- **Fully Automatic** — AI detects event → generates reply → sends immediately (with optional delay)
- **Approval Mode** — AI generates reply → goes to Replies inbox → you review → you approve/send
- **Manual** — events detected, nothing sent automatically

### Auto-Send Flow (when Automatic Mode is ON)
1. Baileys detects a new status
2. `statusProcessingQueue` runs event detection
3. `aiReplyQueue` generates the reply using Intent Detection
4. If `autoReplyEnabled=true` AND `approvalRequired=false`:
   - After `sendDelayMinutes`, message is sent via Baileys automatically
   - No human needed

---

## Event Detection: 20+ Event Types

Text patterns, emojis, Hindi/Hinglish phrases supported:

| Category | Examples Detected |
|----------|------------------|
| Birthday | "happy birthday", "bday", "जन्मदिन", 🎂 |
| Marriage | "got married", "tied the knot", "shaadi", 💒 |
| Engagement | "got engaged", "she said yes", "sagai", 💍 |
| New Business | "shop opening", "grand launch", "new venture", 🏪 |
| New Car | "new car", "car delivery", "new bike", 🚗 |
| Travel | "vacation", "airport", "wanderlust", ✈️ |
| Housewarming | "new home", "griha pravesh", "moved in", 🏠 |
| Baby | "it's a boy/girl", "bundle of joy", 👶 |
| Graduation | "graduated", "convocation", "class of", 🎓 |
| Fitness | "gym", "personal best", "transformation", 💪 |
| ...and more | Festival, Achievement, Sad, Positive, Food, Fashion |

---

## Automation Rules (`/dashboard/automation`)

Visual rule builder: IF event detected → THEN send template

- Industry templates: Restaurant, Real Estate, Automobile, Insurance, Salon, Gym, Travel
- Per-rule: auto-send or approval mode
- Attach coupon codes + discount % per rule
- Configurable send delay

## Coupon Manager (`/dashboard/coupons`)

Create event-linked discount codes:
- % or flat ₹ discount
- Max uses + validity days
- Usage tracking with progress bar

---

## Running the Project

```bash
docker-compose up -d
```

Frontend: http://localhost:3000  
Backend API: http://localhost:4000
