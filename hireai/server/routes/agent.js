const express = require('express');
const Lead = require('../models/Lead');
const Message = require('../models/Message');
const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');
const { processInboundEvent, dispatchOutbound } = require('../services/conversationPipeline');
const { requireAuth } = require('../middleware/auth');
const { idempotency } = require('../middleware/idempotency');
const { asString, asEnum, asInteger, asEmail, asPhone, safeLimit } = require('../utils/validate');

const router = express.Router();

function cleanPhone(raw) {
  if (!raw) return null;
  return String(raw).replace(/^whatsapp:/, '').trim();
}

function cleanEmail(raw) {
  if (!raw) return null;
  return String(raw).trim().toLowerCase();
}

async function emitAgentAction(io, payload) {
  const activity = await ActivityLog.create(payload);
  io.emit('agent:action', activity);
  return activity;
}

async function findOrCreateLead({ leadId, userId, name, phone, email, channel, io }) {
  let lead = null;
  if (leadId) {
    lead = await Lead.getById(leadId);
  }

  const normalizedPhone = cleanPhone(phone);
  const normalizedEmail = cleanEmail(email);

  if (!lead && (normalizedPhone || normalizedEmail)) {
    lead = await Lead.findByContact({
      phone: normalizedPhone,
      email: normalizedEmail,
      channel,
      userId,
    });
  }

  if (!lead) {
    lead = await Lead.create({
      userId,
      name: name || 'New Lead',
      phone: normalizedPhone,
      email: normalizedEmail,
      channel,
      status: 'new',
      sentiment: 'neutral',
    });

    io.emit('lead:updated', lead);

    await emitAgentAction(io, {
      leadId: lead.id,
      leadName: lead.name,
      action: 'replied',
      channel,
      description: `New lead captured from ${lead.name} on ${channel}`,
      sentByAI: true,
    });
  }

  if (!lead.userId && userId) {
    lead = await Lead.update(lead.id, { userId });
  }

  return lead;
}

router.post('/agent/process', requireAuth, idempotency({ scope: (req) => `agent:process:${req.body?.leadId || req.body?.phone || 'new'}` }), async (req, res) => {
  try {
    const io = req.app.get('io');
    const leadId = asInteger(req.body?.leadId, 'leadId', { min: 1, fallback: null });
    const message = asString(req.body?.message, 'message', { required: true, min: 1, max: 5000 });
    const channel = asEnum(req.body?.channel, 'channel', ['whatsapp', 'sms', 'email', 'web', 'webchat', 'manual', 'instagram', 'messenger'], {
      fallback: 'web',
    });
    const name = asString(req.body?.name, 'name', { max: 150 });
    const phone = asPhone(req.body?.phone, 'phone');
    const email = asEmail(req.body?.email, 'email');

    const lead = await findOrCreateLead({
      leadId,
      userId: req.user.id,
      name,
      phone,
      email,
      channel,
      io,
    });

    const output = await processInboundEvent({
      io,
      lead,
      userId: req.user.id,
      channel,
      message,
      metadata: { source: 'agent_process' },
    });

    return res.json(output);
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    console.error('agent process failed', error);
    return res.status(500).json({ error: 'Agent processing failed' });
  }
});

router.post('/agent/takeover/:leadId', requireAuth, async (req, res) => {
  try {
    const io = req.app.get('io');
    const leadId = asInteger(req.params.leadId, 'leadId', { required: true, min: 1 });
    const existing = await Lead.getById(leadId);
    if (!existing || (existing.userId && Number(existing.userId) !== Number(req.user.id))) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const lead = await Lead.setAiPaused(leadId, true);

    io.emit('lead:updated', lead);

    const activity = await emitAgentAction(io, {
      leadId: lead.id,
      leadName: lead.name,
      action: 'needs_human',
      channel: lead.channel,
      description: `Human took over ${lead.name}'s conversation`,
      sentByAI: false,
    });

    return res.json({ lead, activity });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    console.error('takeover failed', error);
    return res.status(500).json({ error: 'Failed to set takeover' });
  }
});

router.post('/agent/handback/:leadId', requireAuth, async (req, res) => {
  try {
    const io = req.app.get('io');
    const leadId = asInteger(req.params.leadId, 'leadId', { required: true, min: 1 });
    const existing = await Lead.getById(leadId);
    if (!existing || (existing.userId && Number(existing.userId) !== Number(req.user.id))) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const lead = await Lead.setAiPaused(leadId, false);

    const resumeMessage =
      'Thanks for your patience. I can continue from where we left off and help you with the next best options. What would you like to prioritize now?';

    let outMessage = await Message.create({
      leadId: lead.id,
      direction: 'out',
      channel: lead.channel,
      content: resumeMessage,
      sentByAI: true,
      draftState: 'sending',
      deliveryStatus: 'queued',
      metadata: { source: 'handback' },
    });

    const user = await User.getById(req.user.id);
    const sendResult = await dispatchOutbound(lead.channel, lead, resumeMessage, user);

    outMessage = await Message.updateDelivery(outMessage.id, {
      externalSid: sendResult.sid || null,
      deliveryStatus: sendResult.success === false ? 'failed' : 'sent',
      error: sendResult.error || null,
      draftState: sendResult.success === false ? 'failed' : 'sent',
    });

    io.emit('lead:updated', lead);
    io.emit('message:sent', {
      ...outMessage,
      leadName: lead.name,
      leadStatus: lead.status,
      icon: '🤖',
    });

    const activity = await emitAgentAction(io, {
      leadId: lead.id,
      leadName: lead.name,
      action: 'replied',
      channel: lead.channel,
      description: `AI resumed conversation with ${lead.name}`,
      sentByAI: true,
    });

    return res.json({ lead, outMessage, activity, sendResult });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    console.error('handback failed', error);
    return res.status(500).json({ error: 'Failed to hand back to AI' });
  }
});

router.get('/agent/status', requireAuth, async (_req, res) => {
  const today = await ActivityLog.todayStats(_req.user.id);

  return res.json({
    active: true,
    messagesProcessed: today.messagesProcessed,
    leadsQualified: today.leadsQualified,
    bookingsMade: today.bookingsMade,
  });
});

router.post('/simulate/message', requireAuth, idempotency({ scope: (req) => `simulate:${req.body?.phone || req.body?.leadId || 'anon'}` }), async (req, res) => {
  try {
    const io = req.app.get('io');
    const leadId = asInteger(req.body?.leadId, 'leadId', { min: 1, fallback: null });
    const name = asString(req.body?.name, 'name', { max: 150 });
    const phone = asPhone(req.body?.phone, 'phone');
    const email = asEmail(req.body?.email, 'email');
    const message = asString(req.body?.message, 'message', { required: true, min: 1, max: 5000 });
    const channel = asEnum(req.body?.channel, 'channel', ['whatsapp', 'sms', 'email', 'web', 'webchat', 'manual', 'instagram', 'messenger'], {
      fallback: 'whatsapp',
    });

    const lead = await findOrCreateLead({
      leadId,
      userId: req.user.id,
      name: name || 'Simulation Lead',
      phone,
      email,
      channel,
      io,
    });

    const output = await processInboundEvent({
      io,
      lead,
      userId: req.user.id,
      channel,
      message,
      metadata: { source: 'simulation' },
    });

    return res.json({
      simulation: true,
      ...output,
    });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    console.error('simulation failed', error);
    return res.status(500).json({ error: 'Simulation failed' });
  }
});

router.get('/activity-log', requireAuth, async (req, res) => {
  const limit = safeLimit(req.query.limit, 100, 300);
  const items = await ActivityLog.recent(limit, req.user.id);
  return res.json({ items });
});

module.exports = router;
