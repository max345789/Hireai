# HireAI — AI-Powered Hiring Command Center

An AI-driven recruitment platform with WhatsApp outreach, automated phone/chat interviews, email campaigns, Google Calendar integration, and Razorpay billing.

---

## Features

- **AI Interviews** — Automated voice + chat interviews powered by Claude AI
- **WhatsApp & SMS Outreach** — Bulk messaging via Twilio
- **Email Campaigns** — Gmail SMTP / SendGrid integration
- **Candidate Pipeline** — Kanban-style tracking with AI scoring
- **Google Calendar** — Auto-schedule interviews
- **Job Widget** — Embeddable careers page widget
- **Razorpay Billing** — INR subscription plans (Starter / Pro / Team)
- **Dark / Light Mode** — Toggle in sidebar

---

## Tech Stack

| Layer    | Tech                                      |
|----------|-------------------------------------------|
| Frontend | React + Vite + Tailwind CSS               |
| Backend  | Node.js + Express                         |
| Database | SQLite (better-sqlite3)                   |
| AI       | Anthropic Claude API                      |
| Payments | Razorpay                                  |
| Comms    | Twilio (WhatsApp/SMS) + Gmail SMTP        |
| Auth     | JWT                                       |

---

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- npm

### 1. Clone and install

```bash
git clone https://github.com/your-username/hireai.git
cd hireai

# Install server deps
cd server && npm install && cd ..

# Install client deps
cd client && npm install && cd ..
```

### 2. Configure environment

```bash
cp server/.env.example server/.env
# Edit server/.env and fill in your keys
```

Required keys to get started:
- `ANTHROPIC_API_KEY` — from console.anthropic.com
- `JWT_SECRET` — any long random string (already pre-set in template)

### 3. Run

```bash
# Terminal 1 — Backend
cd server && npm run dev

# Terminal 2 — Frontend
cd client && npm run dev
```

Open http://localhost:3000

Default login:
- Email: `admin@hireai.local`
- Password: `password123`

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Claude AI key |
| `JWT_SECRET` | ✅ | Random 32+ char string |
| `BASE_URL` | ✅ | Your domain (no trailing slash) |
| `TWILIO_ACCOUNT_SID` | Optional | For WhatsApp/SMS |
| `TWILIO_AUTH_TOKEN` | Optional | For WhatsApp/SMS |
| `TWILIO_WHATSAPP_NUMBER` | Optional | +1234567890 |
| `TWILIO_SMS_NUMBER` | Optional | +1234567890 |
| `GMAIL_USER` | Optional | For email campaigns |
| `GMAIL_APP_PASSWORD` | Optional | Gmail app password |
| `RAZORPAY_KEY_ID` | Optional | Razorpay Key ID |
| `RAZORPAY_KEY_SECRET` | Optional | Razorpay Key Secret |
| `RAZORPAY_WEBHOOK_SECRET` | Optional | Razorpay webhook signing secret |

---

## Deployment

See [DEPLOY.md](./DEPLOY.md) for full instructions:
- **Railway + Vercel** (recommended, free tier available)
- **Docker Compose** (self-hosted VPS)
- **GitHub Actions** CI/CD setup

---

## Razorpay Plans (INR)

| Plan | Price | Candidates | AI Interviews |
|---|---|---|---|
| Starter | ₹14,999/month | 500 | 100/month |
| Pro | ₹29,999/month | 2,000 | 500/month |
| Team | ₹54,999/month | Unlimited | Unlimited |

To go live: replace `rzp_test_...` keys with `rzp_live_...` keys from [dashboard.razorpay.com](https://dashboard.razorpay.com).

---

## Project Structure

```
hireai/
├── server/               # Express backend
│   ├── routes/           # API routes (auth, candidates, billing, etc.)
│   ├── services/         # Business logic (AI, Razorpay, email, etc.)
│   ├── middleware/        # Auth middleware
│   ├── data/             # SQLite database (auto-created)
│   └── index.js          # Entry point
├── client/               # React frontend
│   ├── src/
│   │   ├── pages/        # Page components
│   │   ├── components/   # Shared UI components
│   │   └── lib/          # API client, theme context
│   └── public/           # Static assets
├── docker-compose.yml
├── Dockerfile
├── nginx.conf
└── DEPLOY.md
```

---

## Apps & Ports

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`
- Widget Script: `http://localhost:3001/widget.js`

---

## License

MIT
