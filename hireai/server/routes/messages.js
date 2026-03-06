const express = require('express');
const Lead = require('../models/Lead');
const Message = require('../models/Message');
const ActivityLog = require('../models/ActivityLog');
const twilioService = require('../services/twilioService');
const emailService = require('../services/emailService');
const { requireAuth } = require('../middleware/auth');

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
  const limit = Number(req.query.limit || 80);
  const messages = await Message.recentFeed(limit);
  return res.json({ messages });
});

router.get('/messages/:leadId', requireAuth, async (req, res) => {
  const sinceId = Number(req.query.since || 0);
  const messages = await Message.getByLeadId(req.params.leadId, { sinceId });
  return res.json({ messages });
});

router.post('/messages/send', requireAuth, async (req, res) => {
  try {
    const { leadId, content, channel } = req.body;
    if (!leadId || !content) {
      return res.status(400).json({ error: 'leadId and content are required' });
    }

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
    console.error('manual send failed', error);
    return res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;
