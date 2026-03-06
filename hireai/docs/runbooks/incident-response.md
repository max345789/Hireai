# Runbook: Incident Response

## Severity Guide
- SEV-1: API down or message loss risk
- SEV-2: single channel degraded
- SEV-3: UI issue without data loss

## Initial Triage (first 10 minutes)
1. Check `/api/health` and `/api/ready`.
2. Review structured logs for error spikes.
3. Confirm DB accessibility and disk space.
4. Validate provider credential/config integrity.

## Containment
1. Apply temporary channel pause/takeover where needed.
2. Block abusive senders if attack traffic is present.
3. Raise webhook rate limits only if safe and required.

## Resolution
1. Ship targeted fix behind idempotent endpoints.
2. Run `npm run test` and `npm run build`.
3. Deploy and verify with controlled simulation + real channel test.

## Post-Incident
1. Add regression test.
2. Document root cause and mitigation.
3. Update checklist/runbook.
