# DAB AI — Deployment Guide

## Option A: Railway + Vercel (Recommended — Free to start)

### Backend → Railway

1. Create account at railway.app
2. New project → Deploy from GitHub
3. Select the `dab-ai` repo
4. Set root directory to `/` (Railway will detect Dockerfile)
5. Add environment variables from `.env.example`
6. Deploy → copy the generated URL (e.g. `https://dab-ai-server.up.railway.app`)

### Frontend → Vercel

1. Create account at vercel.com
2. Import GitHub repo
3. Set Framework Preset to **Vite**
4. Set Root Directory to `client`
5. Add env variable: `VITE_API_URL=https://dabcloud.in`
6. Update `client/src/lib/api.js` if needed to use `VITE_API_URL`
7. Deploy → copy your Vercel URL

### Set BASE_URL in Railway
After Vercel deploys, go back to Railway and set:
```
BASE_URL=https://dabcloud.in
FRONTEND_URL=https://dabcloud.in
CORS_ORIGINS=https://dabcloud.in
```

---

## Option B: Docker Compose (Self-hosted VPS)

### Requirements
- VPS with Docker + Docker Compose installed
- Domain name pointing to your VPS IP

### Steps

1. Copy repo to your server:
```bash
git clone https://github.com/you/dab-ai.git
cd dab-ai
```

2. Build frontend:
```bash
cd client && npm install && npm run build && cd ..
```

3. Create `.env` from template:
```bash
cp .env.example .env
# Edit .env with your real values
nano .env
```

4. Start everything:
```bash
docker-compose up -d
```

5. Check status:
```bash
docker-compose ps
docker-compose logs -f server
```

6. For HTTPS, put Nginx on the host with Certbot, or use Cloudflare proxy.

---

## Environment Variables Checklist

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Claude AI key |
| `JWT_SECRET` | ✅ | Random 32+ char string |
| `CORS_ORIGINS` | ✅ | Comma-separated frontend origins |
| `JWT_ACCESS_TTL` | Optional | Access token TTL (default `7d`) |
| `BASE_URL` | ✅ | Public backend base URL, use `https://dabcloud.in` |
| `FRONTEND_URL` | ✅ | Public frontend URL, use `https://dabcloud.in` |
| `TWILIO_ACCOUNT_SID` | Optional | For WhatsApp |
| `TWILIO_AUTH_TOKEN` | Optional | For WhatsApp |
| `TWILIO_WHATSAPP_NUMBER` | Optional | +1234567890 |
| `GMAIL_USER` | Optional | For email |
| `GMAIL_APP_PASSWORD` | Optional | Gmail app password |
| `RAZORPAY_KEY_ID` | Optional | Razorpay Key ID (rzp_live_...) |
| `RAZORPAY_KEY_SECRET` | Optional | Razorpay Key Secret |
| `RAZORPAY_WEBHOOK_SECRET` | Optional | Razorpay webhook signing secret |

---

## Razorpay Setup

1. Log in to [dashboard.razorpay.com](https://dashboard.razorpay.com)
2. Go to **Settings → API Keys** → Generate Live Key
3. Copy `Key ID` → `RAZORPAY_KEY_ID`
4. Copy `Key Secret` → `RAZORPAY_KEY_SECRET`
5. Go to **Settings → Webhooks** → Add New Webhook
6. Set URL: `https://dabcloud.in/api/billing/razorpay/webhook`
7. Select events: `payment.captured`, `payment.failed`
8. Copy the **Webhook Secret** → `RAZORPAY_WEBHOOK_SECRET`

Plans are auto-created at these INR prices:
- **Starter**: ₹14,999/month
- **Pro**: ₹29,999/month
- **Team**: ₹54,999/month

### GitHub Actions CI/CD Setup

Add these secrets to your GitHub repo (Settings → Secrets):
| Secret | Value |
|---|---|
| `RAILWAY_TOKEN` | From railway.app → Account → Tokens |
| `VERCEL_TOKEN` | From vercel.com → Account → Tokens |
| `VERCEL_ORG_ID` | From `.vercel/project.json` after `vercel link` |
| `VERCEL_PROJECT_ID` | From `.vercel/project.json` after `vercel link` |
| `VITE_API_URL` | `https://dabcloud.in` |

---

## Google Calendar Setup

1. Go to console.cloud.google.com
2. Create a project → Enable "Google Calendar API"
3. Create OAuth 2.0 credentials (Web Application)
4. Add redirect URI: `https://dabcloud.in/api/calendar/oauth/callback`
5. In DAB AI Settings → calendarConfig, paste:
```json
{"clientId":"your-client-id","clientSecret":"your-client-secret","redirectUri":"https://dabcloud.in/api/calendar/oauth/callback"}
```
6. Click "Connect Google Calendar" in Settings

---

## Database Backup (SQLite)

The database is at `server/data/dab-ai.db`. For production:

```bash
# Daily backup cron (add to crontab)
0 2 * * * cp /app/data/dab-ai.db /backups/dab-ai-$(date +%Y%m%d).db
```

For Docker volume backup:
```bash
docker run --rm -v dab-ai_dab-ai-db:/data -v $(pwd)/backups:/backup alpine \
  cp /data/dab-ai.db /backup/dab-ai-$(date +%Y%m%d).db
```
