# Runbook: Channel Outage

## Trigger
- Twilio/email send failures spike
- `agent:escalated` events indicate outbound failures

## Immediate Actions
1. Verify provider dashboard status (Twilio/SMTP provider).
2. Check `/api/channels/status` for configured state.
3. Pause AI for impacted high-priority leads if responses are failing repeatedly.
4. Use manual send path for urgent leads.

## Fallback Behavior
- WhatsApp send failures attempt SMS fallback.
- Failed outbound messages are persisted with `deliveryStatus=failed`.

## Recovery
1. Re-test via Settings channel `Test` actions.
2. Re-enable standard workflow and monitor failure rate.
3. Review failed messages and replay manually where needed.
