# HireAI Production Checklist

## Platform Hardening (Completed in code)
- Structured JSON logging with request IDs
- CORS allowlist via `CORS_ORIGINS`
- Helmet security headers
- Auth/webhook/widget rate limiting
- Input validation on critical write endpoints
- Idempotency support (`Idempotency-Key`) for key mutation APIs
- Webhook dedupe + replay safety for Twilio/email
- Webhook payload redaction/truncation in DB
- Health and readiness endpoints (`/api/health`, `/api/ready`)
- Automated DB backup/restore scripts
- CI workflow for test + build + health smoke

## Must-Do Before Go Live (External/ops)
- Configure production secrets in platform env
- Configure public HTTPS domain and reverse proxy
- Set Twilio WhatsApp approved sender + live webhook URLs
- Set inbound email parse provider (SendGrid/Mailgun) to live webhook URL
- Configure SPF, DKIM, DMARC for email sending domain
- Configure production CORS allowlist (`CORS_ORIGINS`)
- Ensure `BOOTSTRAP_ADMIN_ON_START=false` (no automatic admin creation)
- Ensure `ALLOW_MOCK_DELIVERY=false` (no simulated outbound sends)
- Enable external monitoring/alerts (uptime, error tracking)
- Run staging UAT with real channels and sign-off

## Validation Command Pack
```bash
npm run test
npm run build
npm run seed
```

## Backup / Restore
```bash
npm run backup --prefix server
npm run restore --prefix server -- /absolute/path/to/backup.db
```
