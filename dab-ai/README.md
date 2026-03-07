# DAB AI

DAB AI is a full-stack AI Agent Command Center for real-estate teams.
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

First access:
- Register your first user from the login screen (Register tab), or
- optionally enable bootstrap admin in `.env` with:
  - `BOOTSTRAP_ADMIN_ON_START=true`
  - `ADMIN_EMAIL=you@example.com`
  - `ADMIN_PASSWORD=<strong-password>`

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
- Architecture overview: `docs/ARCHITECTURE.md`
- UI uplift plan (7.1 → 9.0): `docs/UI-9.0-PASS-PLAN.md`
- Production checklist: `docs/PRODUCTION-CHECKLIST.md`
- Production env checklist: `docs/PRODUCTION-ENV-CHECKLIST.md`
- Launch day checklist: `docs/LAUNCH-DAY-CHECKLIST.md`
- Runbooks:
  - `docs/runbooks/incident-response.md`
  - `docs/runbooks/channel-outage.md`
  - `docs/runbooks/backup-restore.md`

## Environment
Use `.env.example` as the source of truth for required variables.
For platforms with read-only app directories, set `DB_PATH=/tmp/dab-ai.db`.
For production:
- Intended primary domain: `https://dabcloud.in`
- Set `BASE_URL=https://dabcloud.in`
- Set `FRONTEND_URL=https://dabcloud.in`
- Set `CORS_ORIGINS=https://dabcloud.in`
- `ALLOW_MOCK_DELIVERY=false`
- `BOOTSTRAP_ADMIN_ON_START=false`
- Configure AI chain with one or more keys: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`
- Optional model order override: `AI_MODEL_CHAIN=claude,openai,gemini`
