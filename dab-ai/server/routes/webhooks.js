const express = require('express');
const twilioService = require('../services/twilioService');
const emailService = require('../services/emailService');
const { validateInbound } = require('../services/channelGuard');
const { processInboundEvent } = require('../services/conversationPipeline');
const Lead = require('../models/Lead');
const Message = require('../models/Message');
const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');
const WebhookEvent = require('../models/WebhookEvent');
const IdempotencyKey = require('../models/IdempotencyKey');
const logger = require('../services/logger');
const {
  findUserByTwilioInbound,
  findUserByEmailInbound,
} = require('../services/userIntegrationResolver');

const router = express.Router();

function emit(io, event, payload) {
  if (io) io.emit(event, payload);
}

async function createLeadIfMissing({ channel, userId, name, phone, email, sessionId, io }) {
  let lead = await Lead.findByContact({ phone, email, channel, userId });
  if (!lead && sessionId) {
    const bySession = await Lead.findBySessionId(sessionId);
    if (bySession && (!userId || !bySession.userId || Number(bySession.userId) === Number(userId))) {
      lead = bySession;
    }
  }

  if (!lead) {
    lead = await Lead.create({
      userId,
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
      userId: lead.userId || userId || null,
      leadName: lead.name,
      action: 'replied',
      channel,
      description: `🤖 New lead from ${lead.name}`,
      sentByAI: true,
    });

    emit(io, 'agent:action', activity);
  }

  if (lead && !lead.userId && userId) {
    lead = await Lead.update(lead.id, { userId });
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
    userId: lead.userId || null,
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
  const matchedUser = await findUserByTwilioInbound(parsed);
  const matchedUserId = matchedUser?.id || null;

  if (!matchedUserId) {
    await WebhookEvent.markFailed(eventId, 'No matching user for inbound Twilio webhook');
    logger.warn('unmatched_whatsapp_webhook', {
      requestId: req.requestId,
      from: parsed.from,
      to: parsed.to,
      accountSid: parsed.accountSid,
    });
    return;
  }

  const lead = await createLeadIfMissing({
    channel: 'whatsapp',
    userId: matchedUserId,
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

  const result = await processInboundEvent({
    io,
    lead,
    userId: lead.userId || matchedUserId,
    channel: 'whatsapp',
    message: guard.profanity
      ? `${parsed.message}\n\n[system: profanity detected, escalate to human]`
      : parsed.message,
    externalSid: parsed.twilioSid,
    metadata: { source: 'webhook_whatsapp' },
  });

  if (guard.profanity && result?.lead?.status !== 'escalated') {
    await Lead.update(lead.id, { status: 'escalated' });
    await handlePausedLead(io, lead, 'whatsapp', `Profanity detected from ${lead.name}; escalated to human`);
  }

  await WebhookEvent.markProcessed(eventId);
  return result?.inMessage || null;
}

async function processEmailWebhook(req, eventId) {
  const io = req.app.get('io');
  const parsed = emailService.parseInbound(req.body || {});
  const matchedUser = await findUserByEmailInbound(parsed);
  const matchedUserId = matchedUser?.id || null;

  if (!parsed.from || !parsed.cleanText) {
    await WebhookEvent.markFailed(eventId, 'Missing from or cleaned text');
    return;
  }

  if (!matchedUserId) {
    await WebhookEvent.markFailed(eventId, 'No matching user for inbound email webhook');
    logger.warn('unmatched_email_webhook', {
      requestId: req.requestId,
      from: parsed.from,
      to: parsed.to,
      subject: parsed.subject,
    });
    return;
  }

  const lead = await createLeadIfMissing({
    channel: 'email',
    userId: matchedUserId,
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

  await processInboundEvent({
    io,
    lead,
    userId: lead.userId || matchedUserId,
    channel: 'email',
    message: guard.profanity
      ? `${parsed.cleanText}\n\n[system: profanity detected, escalate to human]`
      : parsed.cleanText,
    externalSid: req.body?.MessageSid || req.body?.message_id || null,
    metadata: { source: 'webhook_email', subject: parsed.subject },
  });

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
