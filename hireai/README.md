# HireAI

HireAI is a full-stack AI Agent Command Center for real-estate teams.
It unifies WhatsApp, email, and web chat into one workspace where Claude-powered automation can qualify leads, book viewings, and escalate when needed.

## Stack
- Frontend: React + Vite + Tailwind
- Backend: Node.js + Express + Socket.io
- Database: SQLite
- AI: Anthropic Claude (`claude-sonnet-4-20250514`)
- Channels: Twilio WhatsApp/SMS, Gmail SMTP, Web Widget

## Local Setup

```bash
npm run install:all
cp .env.example .env
npm run seed
npm run dev
```

App URLs:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`
- Widget script: `http://localhost:3001/widget.js`

Default demo login:
- Email: `admin@hireai.local`
- Password: `password123`

## Commands

```bash
npm run dev
npm run test
npm run build
npm run seed
npm run backup --prefix server
npm run restore --prefix server -- /absolute/path/to/backup.db
```

## Key APIs
- `POST /api/agent/process`
- `POST /api/simulate/message`
- `POST /api/webhook/whatsapp`
- `POST /api/webhook/email`
- `POST /api/widget/session`
- `POST /api/widget/message`
- `GET /api/channels/status`
- `GET /api/analytics/today`
- `GET /api/health`
- `GET /api/ready`

## Production Hardening Included
- Request ID + structured logging
- CORS allowlist (`CORS_ORIGINS`)
- Helmet security headers
- Auth/webhook/widget rate limiting
- Input validation on critical write routes
- Idempotency middleware (`Idempotency-Key`) for mutation routes
- Webhook dedupe for Twilio/email retry safety
- Redacted + truncated webhook payload storage
- CI workflow for server tests + client build + API smoke checks

## Documentation
- Production checklist: `docs/PRODUCTION-CHECKLIST.md`
- Runbooks:
  - `docs/runbooks/incident-response.md`
  - `docs/runbooks/channel-outage.md`
  - `docs/runbooks/backup-restore.md`

## Environment
Use `.env.example` as the source of truth for required variables.
