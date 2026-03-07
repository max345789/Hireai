const test = require('node:test');
const assert = require('node:assert/strict');

const { runOrchestrator, runAnalyst, runResponder } = require('../services/aiRoleService');
const { evaluateGuardrails } = require('../services/guardrailService');

function withNoAnthropic(t) {
  const prev = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = '';
  t.after(() => {
    process.env.ANTHROPIC_API_KEY = prev;
  });
}

test('orchestrator fallback escalates negative sentiment', async (t) => {
  withNoAnthropic(t);

  const output = await runOrchestrator({
    currentMessage: 'This is terrible and I want a refund right now.',
    channel: 'whatsapp',
    lead: { status: 'new' },
  });

  assert.equal(output.action, 'escalate');
  assert.equal(output.status, 'escalated');
  assert.equal(output.requiresHuman, true);
  assert.ok(output.riskFlags.includes('negative_sentiment'));
});

test('analyst fallback extracts lead intelligence fields', async (t) => {
  withNoAnthropic(t);

  const output = await runAnalyst({
    currentMessage: 'Need a 3bhk in Indiranagar around $500k next month, urgent.',
    lead: {},
  });

  assert.equal(output.intent, 'property_inquiry');
  assert.equal(output.urgency, 'high');
  assert.equal(output.budget, '$500k');
  assert.equal(output.timeline.toLowerCase(), 'next month');
  assert.equal(output.propertyType.toLowerCase(), '3bhk');
  assert.equal(output.location, 'Indiranagar around');
});

test('responder fallback formats email output with signature', async (t) => {
  withNoAnthropic(t);

  const output = await runResponder({
    channel: 'email',
    agencyName: 'Acme Realty',
    orchestrator: { action: 'qualify' },
    analyst: { intent: 'property_inquiry' },
    lead: { name: 'Lead' },
    currentMessage: 'I am interested',
  });

  assert.ok(output.startsWith('Hello,'));
  assert.ok(output.includes('Best regards,'));
  assert.ok(output.includes('Acme Realty'));
});

test('guardrails allow only safe high-confidence auto-send', () => {
  const safe = evaluateGuardrails({
    confidence: 0.92,
    riskFlags: [],
    requiresHuman: false,
    profanity: false,
    leadPaused: false,
  });

  assert.equal(safe.autoSend, true);
  assert.deepEqual(safe.reasons, []);

  const flagged = evaluateGuardrails({
    confidence: 0.55,
    riskFlags: ['sensitive_intent'],
    requiresHuman: true,
    profanity: true,
    leadPaused: false,
  });

  assert.equal(flagged.autoSend, false);
  assert.ok(flagged.reasons.includes('low_confidence'));
  assert.ok(flagged.reasons.includes('risk_flags_present'));
  assert.ok(flagged.reasons.includes('orchestrator_requires_human'));
  assert.ok(flagged.reasons.includes('profanity_detected'));
});
