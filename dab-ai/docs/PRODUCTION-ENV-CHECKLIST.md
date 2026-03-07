# DAB AI Production Env Checklist

Target domain:
- `https://dabcloud.in`

Free setup to finish first:
- `BASE_URL=https://dabcloud.in`
- `FRONTEND_URL=https://dabcloud.in`
- `CORS_ORIGINS=https://dabcloud.in`
- `NODE_ENV=production`
- `ALLOW_MOCK_DELIVERY=false`
- `BOOTSTRAP_ADMIN_ON_START=false`
- `JWT_SECRET=<32+ random chars>`

Core app variables:
- `PORT=3001`
- `JWT_ACCESS_TTL=7d`
- `LOG_LEVEL=info`
- `REQUEST_BODY_LIMIT=1mb`
- `WEBHOOK_RATE_WINDOW_MS=900000`
- `WEBHOOK_RATE_MAX=300`
- `WIDGET_RATE_WINDOW_MS=60000`
- `WIDGET_RATE_MAX=80`
- `AUTH_RATE_WINDOW_MS=900000`
- `AUTH_RATE_MAX=40`
- `SANITIZE_WEBHOOK_PAYLOADS=true`
- `WEBHOOK_PAYLOAD_MAX_CHARS=12000`

AI provider variables:
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `AI_MODEL_CHAIN=claude,openai,gemini`

Optional paid integrations later:
- Twilio:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_WHATSAPP_NUMBER`
  - `TWILIO_SMS_NUMBER`
- Email:
  - `GMAIL_USER`
  - `GMAIL_APP_PASSWORD`
- Google Calendar:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - OAuth redirect URI: `https://dabcloud.in/api/calendar/oauth/callback`
- Meta:
  - `META_PAGE_ACCESS_TOKEN`
  - `META_VERIFY_TOKEN`
  - `META_APP_SECRET`
  - Webhook callback: `https://dabcloud.in/api/webhook/meta`
- Billing:
  - `RAZORPAY_KEY_ID`
  - `RAZORPAY_KEY_SECRET`
  - `RAZORPAY_WEBHOOK_SECRET`
  - Webhook callback: `https://dabcloud.in/api/billing/razorpay/webhook`

Frontend build variables:
- `VITE_API_URL=https://dabcloud.in`
- `VITE_WS_URL=https://dabcloud.in`
