const express = require('express');
const twilioService = require('../services/twilioService');
const emailService = require('../services/emailService');
const { validateInbound } = require('../services/channelGuard');
const { processMessage } = require('../services/agentBrain');
const Lead = require('../models/Lead');
const Message = require('../models/Message');
const ActivityLog = require('../models/ActivityLog');
const WebhookEvent = require('../models/WebhookEvent');
const IdempotencyKey = require('../models/IdempotencyKey');
const logger = require('../services/logger');

const router = express.Router();

function emit(io, event, payload) {
  if (io) io.emit(event, payload);
}

async function createLeadIfMissing({ channel, name, phone, email, sessionId, io }) {
  let lead = await Lead.findByContact({ phone, email, channel });
  if (!lead && sessionId) {
    lead = await Lead.findBySessionId(sessionId);
  }

  if (!lead) {
    lead = await Lead.create({
      name: name || email?.split('@')[0] || 'New Lead',
      phone: phone || null,
      email: email || null,
      sessionId: sessionId || null,
      channel,
      status: 'new',
      sentiment: 'neutral',
    });

    emit(io, 'lead:updated', lead);

    const activity = await ActivityLog.create({
      leadId: lead.id,
      leadName: lead.name,
      action: 'replied',
      channel,
      description: `🤖 New lead from ${lead.name}`,
      sentByAI: true,
    });

    emit(io, 'agent:action', activity);
  }

  return lead;
}

async function addInboundMessage(io, { lead, channel, content, externalSid = null, metadata = null }) {
  const inMessage = await Message.create({
    leadId: lead.id,
    direction: 'in',
    channel,
    content,
    sentByAI: false,
    externalSid,
    deliveryStatus: 'received',
    metadata,
  });

  emit(io, 'message:new', {
    ...inMessage,
    leadName: lead.name,
    leadStatus: lead.status,
    icon: '👤',
  });

  return inMessage;
}

async function handlePausedLead(io, lead, channel, reason, escalate = true) {
  const activity = await ActivityLog.create({
    leadId: lead.id,
    leadName: lead.name,
    action: 'needs_human',
    channel,
    description: reason,
    sentByAI: false,
  });

  emit(io, 'agent:action', activity);
  if (escalate) {
    emit(io, 'agent:escalated', {
      leadId: lead.id,
      leadName: lead.name,
      reason,
      channel,
    });
  }
}

async function processWhatsappWebhook(req, eventId, parsed) {
  const io = req.app.get('io');

  const lead = await createLeadIfMissing({
    channel: 'whatsapp',
    name: parsed.profileName || 'WhatsApp Lead',
    phone: parsed.from,
    email: null,
    io,
  });

  const guard = await validateInbound({
    lead,
    phone: parsed.from,
    content: parsed.message || parsed.mediaUrl || parsed.messageType,
  });

  if (!guard.ok) {
    await WebhookEvent.markFailed(eventId, `Dropped inbound due to ${guard.reason}`);
    const shouldEscalate = !['duplicate', 'rate_limited', 'opt_out', 'opt_in_ack'].includes(guard.reason);
    await handlePausedLead(io, lead, 'whatsapp', `Inbound message blocked: ${guard.reason}`, shouldEscalate);
    return;
  }

  if (parsed.messageType !== 'text') {
    const mediaDescription = parsed.messageType === 'image'
      ? 'Client sent an image'
      : parsed.messageType === 'audio'
        ? 'Client sent voice note'
        : 'Client sent media';

    await addInboundMessage(io, {
      lead,
      channel: 'whatsapp',
      content: `${mediaDescription}${parsed.mediaUrl ? ` (${parsed.mediaUrl})` : ''}`,
      externalSid: parsed.twilioSid,
      metadata: { mediaUrl: parsed.mediaUrl, mediaContentType: parsed.mediaContentType },
    });

    await handlePausedLead(io, lead, 'whatsapp', `${mediaDescription} from ${lead.name}; please review manually.`);
    await WebhookEvent.markProcessed(eventId);
    return;
  }

  const inMessage = await addInboundMessage(io, {
    lead,
    channel: 'whatsapp',
    content: parsed.message,
    externalSid: parsed.twilioSid,
  });

  if (lead.aiPaused) {
    await handlePausedLead(io, lead, 'whatsapp', `New message from ${lead.name} while human takeover is active`);
    await WebhookEvent.markProcessed(eventId);
    return;
  }

  const history = await Message.getByLeadId(lead.id);
  const result = await processMessage(
    guard.profanity ? `${parsed.message}\n\n[system: profanity detected, escalate to human]` : parsed.message,
    lead,
    history.slice(-10),
    { io, channel: 'whatsapp' }
  );

  if (guard.profanity && result?.lead?.status !== 'escalated') {
    await Lead.update(lead.id, { status: 'escalated' });
    await handlePausedLead(io, lead, 'whatsapp', `Profanity detected from ${lead.name}; escalated to human`);
  }

  await WebhookEvent.markProcessed(eventId);
  return inMessage;
}

async function processEmailWebhook(req, eventId) {
  const io = req.app.get('io');
  const parsed = emailService.parseInbound(req.body || {});

  if (!parsed.from || !parsed.cleanText) {
    await WebhookEvent.markFailed(eventId, 'Missing from or cleaned text');
    return;
  }

  const lead = await createLeadIfMissing({
    channel: 'email',
    name: parsed.from.split('@')[0],
    phone: null,
    email: parsed.from,
    io,
  });

  const guard = await validateInbound({
    lead,
    phone: null,
    content: parsed.cleanText,
  });

  if (!guard.ok) {
    await WebhookEvent.markFailed(eventId, `Dropped inbound due to ${guard.reason}`);
    const shouldEscalate = !['duplicate', 'rate_limited', 'opt_out', 'opt_in_ack'].includes(guard.reason);
    await handlePausedLead(io, lead, 'email', `Inbound email blocked: ${guard.reason}`, shouldEscalate);
    return;
  }

  await addInboundMessage(io, {
    lead,
    channel: 'email',
    content: `${parsed.subject}\n\n${parsed.cleanText}`,
    externalSid: req.body?.MessageSid || req.body?.message_id || null,
    metadata: { subject: parsed.subject },
  });

  if (lead.aiPaused) {
    await handlePausedLead(io, lead, 'email', `New email from ${lead.name} while human takeover is active`);
    await WebhookEvent.markProcessed(eventId);
    return;
  }

  const history = await Message.getByLeadId(lead.id);
  await processMessage(
    guard.profanity ? `${parsed.cleanText}\n\n[system: profanity detected, escalate to human]` : parsed.cleanText,
    lead,
    history.slice(-10),
    { io, channel: 'email' }
  );

  if (guard.profanity) {
    await Lead.update(lead.id, { status: 'escalated' });
    await handlePausedLead(io, lead, 'email', `Profanity detected from ${lead.name}; escalated to human`);
  }

  await WebhookEvent.markProcessed(eventId);
}

router.post('/webhook/whatsapp', async (req, res) => {
  if (!twilioService.validateWebhook(req)) {
    return res.status(403).send('Invalid Twilio signature');
  }

  const parsed = twilioService.parseIncoming(req.body || {});
  const eventKey = parsed.twilioSid || `${parsed.from || 'unknown'}:${parsed.messageType}:${parsed.message || ''}`.slice(0, 120);
  const reservation = await IdempotencyKey.reserve('webhook:whatsapp', eventKey, eventKey, 72);

  if (!reservation.created && reservation.row?.status !== 'failed') {
    logger.info('duplicate_whatsapp_webhook_ignored', {
      requestId: req.requestId,
      eventKey,
      from: parsed.from,
    });
    return res.type('text/xml').send('<Response></Response>');
  }
  if (!reservation.created && reservation.row?.status === 'failed') {
    await IdempotencyKey.markProcessing(reservation.row.id);
  }

  const event = await WebhookEvent.create({
    channel: 'whatsapp',
    eventType: 'incoming',
    payload: req.body,
  });

  res.type('text/xml').send('<Response></Response>');

  setImmediate(async () => {
    try {
      await processWhatsappWebhook(req, event.id, parsed);
      await IdempotencyKey.complete(reservation.row.id, 200, JSON.stringify({ ok: true }));
    } catch (error) {
      await WebhookEvent.markFailed(event.id, error.message);
      await IdempotencyKey.fail(reservation.row.id, 500, JSON.stringify({ error: error.message }));
      console.error('async whatsapp processing failed', error);
    }
  });

  return undefined;
});

router.post('/webhook/email', async (req, res) => {
  const parsed = emailService.parseInbound(req.body || {});
  const eventKeySource = req.body?.message_id || req.body?.MessageSid || `${parsed.from || 'unknown'}:${parsed.subject || ''}:${parsed.cleanText || ''}`;
  const eventKey = String(eventKeySource).slice(0, 220);
  const reservation = await IdempotencyKey.reserve('webhook:email', eventKey, eventKey, 72);

  if (!reservation.created && reservation.row?.status !== 'failed') {
    logger.info('duplicate_email_webhook_ignored', {
      requestId: req.requestId,
      eventKey,
      from: parsed.from,
    });
    return res.status(200).json({ received: true, duplicate: true });
  }
  if (!reservation.created && reservation.row?.status === 'failed') {
    await IdempotencyKey.markProcessing(reservation.row.id);
  }

  const event = await WebhookEvent.create({
    channel: 'email',
    eventType: 'incoming',
    payload: req.body,
  });

  res.status(200).json({ received: true });

  setImmediate(async () => {
    try {
      await processEmailWebhook(req, event.id);
      await IdempotencyKey.complete(reservation.row.id, 200, JSON.stringify({ ok: true }));
    } catch (error) {
      await WebhookEvent.markFailed(event.id, error.message);
      await IdempotencyKey.fail(reservation.row.id, 500, JSON.stringify({ error: error.message }));
      console.error('async email processing failed', error);
    }
  });

  return undefined;
});

module.exports = router;
