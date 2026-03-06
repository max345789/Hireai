const express = require('express');
const Lead = require('../models/Lead');
const Message = require('../models/Message');
const ActivityLog = require('../models/ActivityLog');
const { processMessage } = require('../services/agentBrain');
const { requireAuth } = require('../middleware/auth');
const twilioService = require('../services/twilioService');
const emailService = require('../services/emailService');
const { validateInbound } = require('../services/channelGuard');

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

async function dispatchOutbound(lead, channel, content) {
  if (!content) return { success: true, mocked: true, sid: null };

  if (channel === 'whatsapp' && lead.phone) {
    return twilioService.sendWhatsApp(lead.phone, content);
  }

  if (channel === 'sms' && lead.phone) {
    return twilioService.sendSMS(lead.phone, content);
  }

  if (channel === 'email' && lead.email) {
    return emailService.send(lead.email, 'Property Update', content, content, {
      agencyName: 'HireAI Realty',
      agencyLogo: null,
    });
  }

  return { success: true, mocked: true, sid: null };
}

async function findOrCreateLead({ leadId, name, phone, email, channel, io }) {
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
    });
  }

  if (!lead) {
    lead = await Lead.create({
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

  return lead;
}

async function processIncoming({ io, message, channel, lead }) {
  const guard = await validateInbound({
    lead,
    phone: lead.phone,
    content: message,
  });

  if (!guard.ok) {
    await emitAgentAction(io, {
      leadId: lead.id,
      leadName: lead.name,
      action: 'needs_human',
      channel,
      description: `Inbound blocked (${guard.reason}) for ${lead.name}`,
      sentByAI: false,
    });

    return {
      blocked: true,
      reason: guard.reason,
      lead,
    };
  }

  const inMessage = await Message.create({
    leadId: lead.id,
    direction: 'in',
    channel,
    content: message,
    sentByAI: false,
    deliveryStatus: 'received',
    metadata: { source: 'agent_process' },
  });

  io.emit('message:new', {
    ...inMessage,
    leadName: lead.name,
    leadStatus: lead.status,
    icon: '👤',
  });

  if (lead.aiPaused) {
    const activity = await emitAgentAction(io, {
      leadId: lead.id,
      leadName: lead.name,
      action: 'needs_human',
      channel,
      description: `Conversation paused for ${lead.name}; human agent handling this thread`,
      sentByAI: false,
    });

    io.emit('agent:escalated', {
      leadId: lead.id,
      leadName: lead.name,
      reason: 'AI is paused for this conversation',
      channel,
    });

    return {
      paused: true,
      lead,
      inMessage,
      activity,
    };
  }

  const history = await Message.getByLeadId(lead.id);
  const result = await processMessage(
    guard.profanity ? `${message}\n\n[system: profanity detected, escalate to human]` : message,
    lead,
    history.slice(-10),
    {
      io,
      channel,
    }
  );

  return {
    paused: false,
    lead: result.lead,
    inMessage,
    result,
  };
}

router.post('/agent/process', requireAuth, async (req, res) => {
  try {
    const io = req.app.get('io');
    const { leadId, message, channel = 'web', name, phone, email } = req.body || {};

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const lead = await findOrCreateLead({
      leadId,
      name,
      phone,
      email,
      channel,
      io,
    });

    const output = await processIncoming({
      io,
      message,
      channel,
      lead,
    });

    return res.json(output);
  } catch (error) {
    console.error('agent process failed', error);
    return res.status(500).json({ error: 'Agent processing failed' });
  }
});

router.post('/agent/takeover/:leadId', requireAuth, async (req, res) => {
  try {
    const io = req.app.get('io');
    const lead = await Lead.setAiPaused(req.params.leadId, true);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

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
    console.error('takeover failed', error);
    return res.status(500).json({ error: 'Failed to set takeover' });
  }
});

router.post('/agent/handback/:leadId', requireAuth, async (req, res) => {
  try {
    const io = req.app.get('io');
    const lead = await Lead.setAiPaused(req.params.leadId, false);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const resumeMessage =
      'Thanks for your patience. I can continue from where we left off and help you with the next best options. What would you like to prioritize now?';

    let outMessage = await Message.create({
      leadId: lead.id,
      direction: 'out',
      channel: lead.channel,
      content: resumeMessage,
      sentByAI: true,
      deliveryStatus: 'queued',
      metadata: { source: 'handback' },
    });

    const sendResult = await dispatchOutbound(lead, lead.channel, resumeMessage);

    outMessage = await Message.updateDelivery(outMessage.id, {
      externalSid: sendResult.sid || null,
      deliveryStatus: sendResult.success === false ? 'failed' : 'sent',
      error: sendResult.error || null,
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
    console.error('handback failed', error);
    return res.status(500).json({ error: 'Failed to hand back to AI' });
  }
});

router.get('/agent/status', requireAuth, async (_req, res) => {
  const today = await ActivityLog.todayStats();

  return res.json({
    active: true,
    messagesProcessed: today.messagesProcessed,
    leadsQualified: today.leadsQualified,
    bookingsMade: today.bookingsMade,
  });
});

router.post('/simulate/message', requireAuth, async (req, res) => {
  try {
    const io = req.app.get('io');
    const {
      leadId,
      name,
      phone,
      email,
      message,
      channel = 'whatsapp',
    } = req.body || {};

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const lead = await findOrCreateLead({
      leadId,
      name: name || 'Simulation Lead',
      phone,
      email,
      channel,
      io,
    });

    const output = await processIncoming({
      io,
      message,
      channel,
      lead,
    });

    return res.json({
      simulation: true,
      ...output,
    });
  } catch (error) {
    console.error('simulation failed', error);
    return res.status(500).json({ error: 'Simulation failed' });
  }
});

router.get('/activity-log', requireAuth, async (req, res) => {
  const limit = Number(req.query.limit || 100);
  const items = await ActivityLog.recent(limit);
  return res.json({ items });
});

module.exports = router;
