# Launch Day Checklist (Today + Tomorrow)

## Today (must finish before freeze)

1. **Set production environment variables**
   - Required: `NODE_ENV=production`, `JWT_SECRET` (32+ chars), `BASE_URL=https://dabcloud.in`, `FRONTEND_URL=https://dabcloud.in`, `CORS_ORIGINS=https://dabcloud.in`, `ALLOW_MOCK_DELIVERY=false`, `BOOTSTRAP_ADMIN_ON_START=false`.
2. **Configure AI model chain for 24/7 resilience**
   - Add at least one of: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`.
   - Set `AI_MODEL_CHAIN=claude,openai,gemini` (or your preferred order).
3. **Provider-level validation**
   - Verify Anthropic/OpenAI/Gemini credentials using test prompts.
4. **Channel integration checks**
   - Twilio webhook URL + signature validation.
   - Inbound email webhook pipeline.
   - Optional Meta/Calendar/Billing integrations.
5. **Data safety checks**
   - Run DB backup and validate restore path.
6. **Regression checks**
   - Run `npm test` and verify green.
   - Smoke test key routes: login, lead ingestion, AI response, manual send, booking flow.

## Tomorrow (launch execution)

1. **Deploy exact tested commit**.
2. **Run post-deploy smoke checks**
   - `GET /api/health`
   - `GET /api/ready`
   - Simulate inbound message and confirm AI response.
3. **Monitor first 2 hours**
   - Error logs, webhook retries, message delivery failures.
4. **Fallback monitoring policy**
   - If provider 1 fails, confirm provider 2/3 continues responses.
   - If all providers fail, confirm deterministic fallback still responds.
5. **Go/no-go checkpoint**
   - Confirm no P1 errors and acceptable response latency.

## Manual Ops follow-ups (same day after launch)

1. Rotate temporary secrets used during testing.
2. Enable uptime and alerting thresholds.
3. Schedule daily backup verification job review.
