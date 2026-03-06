const express = require('express');
const Lead = require('../models/Lead');
const Message = require('../models/Message');
const ActivityLog = require('../models/ActivityLog');
const twilioService = require('../services/twilioService');
const emailService = require('../services/emailService');
const { requireAuth } = require('../middleware/auth');
const { idempotency } = require('../middleware/idempotency');
const { asInteger, asString, asEnum, safeLimit } = require('../utils/validate');

const router = express.Router();

async function sendOutbound(lead, channel, content) {
  if (channel === 'whatsapp' && lead.phone) {
    return twilioService.sendWhatsApp(lead.phone, content);
  }

  if (channel === 'sms' && lead.phone) {
    return twilioService.sendSMS(lead.phone, content);
  }

  if (channel === 'email' && lead.email) {
    return emailService.send(lead.email, 'Re: Your Property Inquiry', content, content, {
      agencyName: 'HireAI Realty',
      agencyLogo: null,
    });
  }

  return { mocked: true, success: true, sid: null, channel };
}

router.get('/messages', requireAuth, async (req, res) => {
  const limit = safeLimit(req.query.limit, 80, 200);
  const messages = await Message.recentFeed(limit);
  return res.json({ messages });
});

router.get('/messages/:leadId', requireAuth, async (req, res) => {
  try {
    const leadId = asInteger(req.params.leadId, 'leadId', { required: true, min: 1 });
    const sinceId = asInteger(req.query.since, 'since', { min: 0, fallback: 0 });
    const messages = await Message.getByLeadId(leadId, { sinceId });
    return res.json({ messages });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to load messages' });
  }
});

router.post('/messages/send', requireAuth, idempotency({ scope: (req) => `messages:send:${req.body?.leadId || 'unknown'}` }), async (req, res) => {
  try {
    const leadId = asInteger(req.body?.leadId, 'leadId', { required: true, min: 1 });
    const content = asString(req.body?.content, 'content', { required: true, min: 1, max: 5000 });
    const channel = asEnum(req.body?.channel, 'channel', ['whatsapp', 'sms', 'email', 'web', 'webchat', 'manual'], {
      fallback: null,
    });

    const lead = await Lead.getById(leadId);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const finalChannel = channel || lead.channel;

    let outMessage = await Message.create({
      leadId,
      direction: 'out',
      channel: finalChannel,
      content,
      sentByAI: false,
      deliveryStatus: 'queued',
      metadata: { source: 'manual' },
    });

    const sendResult = await sendOutbound(lead, finalChannel, content);

    outMessage = await Message.updateDelivery(outMessage.id, {
      externalSid: sendResult.sid || null,
      deliveryStatus: sendResult.success === false ? 'failed' : 'sent',
      error: sendResult.error || null,
    });

    const activity = await ActivityLog.create({
      leadId,
      leadName: lead.name,
      action: 'needs_human',
      channel: finalChannel,
      description:
        sendResult.success === false
          ? `Manual send failed for ${lead.name}: ${sendResult.error}`
          : `Human replied manually to ${lead.name} on ${finalChannel}`,
      sentByAI: false,
    });

    const io = req.app.get('io');
    io.emit('message:sent', {
      ...outMessage,
      leadName: lead.name,
      leadStatus: lead.status,
      icon: '👤',
    });
    io.emit('agent:action', activity);

    if (sendResult.success === false) {
      io.emit('agent:escalated', {
        leadId: lead.id,
        leadName: lead.name,
        reason: `Manual outbound failed: ${sendResult.error}`,
        channel: finalChannel,
      });
    }

    return res.status(201).json({ message: outMessage, activity, sendResult });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    console.error('manual send failed', error);
    return res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;
