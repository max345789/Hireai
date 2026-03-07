const express = require('express');
const Lead = require('../models/Lead');
const Message = require('../models/Message');
const Booking = require('../models/Booking');
const ActivityLog = require('../models/ActivityLog');
const { requireAuth } = require('../middleware/auth');
const { dispatchOutbound } = require('../services/conversationPipeline');
const User = require('../models/User');
const { asInteger, asString, safeLimit } = require('../utils/validate');

const router = express.Router();

function emit(io, event, payload) {
  if (io) io.emit(event, payload);
}

router.get('/inbox/threads', requireAuth, async (req, res) => {
  try {
    const limit = safeLimit(req.query.limit, 120, 300);
    const rows = await Message.listThreads({ userId: req.user.id, limit });

    return res.json({ threads: rows });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/inbox/threads/:threadId', requireAuth, async (req, res) => {
  try {
    const threadId = asInteger(req.params.threadId, 'threadId', { required: true, min: 1 });
    const lead = await Lead.getById(threadId);
    if (!lead || (lead.userId && Number(lead.userId) !== Number(req.user.id))) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const messages = await Message.getByLeadId(threadId);
    const bookings = (await Booking.all()).filter((item) => Number(item.leadId) === threadId);

    const latestDecision = [...messages]
      .reverse()
      .find((item) => item.orchestratorDecision || item.intelligenceSnapshot);

    return res.json({
      thread: {
        lead,
        messages,
        bookings,
        summary: {
          latestDecision: latestDecision?.orchestratorDecision || null,
          riskFlags: latestDecision?.riskFlags || [],
          confidence: latestDecision?.confidence ?? null,
          intelligence: latestDecision?.intelligenceSnapshot || lead.intelligenceSnapshot || null,
        },
      },
    });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
});

router.post('/inbox/threads/:threadId/reply', requireAuth, async (req, res) => {
  try {
    const threadId = asInteger(req.params.threadId, 'threadId', { required: true, min: 1 });
    const content = asString(req.body?.content, 'content', { required: true, min: 1, max: 5000 });

    const lead = await Lead.getById(threadId);
    if (!lead || (lead.userId && Number(lead.userId) !== Number(req.user.id))) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const user = await User.getById(req.user.id);

    let message = await Message.create({
      leadId: lead.id,
      direction: 'out',
      channel: lead.channel,
      content,
      sentByAI: false,
      draftState: 'sending',
      deliveryStatus: 'queued',
      metadata: { source: 'inbox_manual_reply' },
    });

    const sendResult = await dispatchOutbound(lead.channel, lead, content, user);

    message = await Message.updateDelivery(message.id, {
      externalSid: sendResult?.sid || null,
      deliveryStatus: sendResult?.success === false ? 'failed' : 'sent',
      error: sendResult?.error || null,
      draftState: sendResult?.success === false ? 'failed' : 'sent',
    });

    const activity = await ActivityLog.create({
      leadId: lead.id,
      leadName: lead.name,
      action: sendResult?.success === false ? 'needs_human' : 'replied',
      channel: lead.channel,
      description: sendResult?.success === false
        ? `Manual reply failed: ${sendResult.error || 'unknown error'}`
        : `Manual reply sent from inbox to ${lead.name}`,
      sentByAI: false,
    });

    const io = req.app.get('io');
    emit(io, 'message:sent', {
      ...message,
      leadName: lead.name,
      leadStatus: lead.status,
      icon: sendResult?.success === false ? '⚠️' : '👤',
    });
    emit(io, 'agent:action', activity);

    return res.status(201).json({ message, activity, sendResult });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
});

router.post('/inbox/threads/:threadId/approve-and-send', requireAuth, async (req, res) => {
  try {
    const threadId = asInteger(req.params.threadId, 'threadId', { required: true, min: 1 });
    const messageId = asInteger(req.body?.messageId, 'messageId', { required: true, min: 1 });
    const editedContent = asString(req.body?.content, 'content', { min: 1, max: 5000 });

    const lead = await Lead.getById(threadId);
    if (!lead || (lead.userId && Number(lead.userId) !== Number(req.user.id))) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    let message = await Message.getById(messageId);
    if (!message || Number(message.leadId) !== Number(lead.id)) {
      return res.status(404).json({ error: 'Message draft not found' });
    }

    if (message.draftState !== 'pending_approval') {
      return res.status(400).json({ error: 'Message is not pending approval' });
    }

    if (editedContent) {
      message = await Message.updateDraft(message.id, {
        content: editedContent,
      });
    }

    const user = await User.getById(req.user.id);
    const sendResult = await dispatchOutbound(lead.channel, lead, message.content, user);

    message = await Message.updateDelivery(message.id, {
      externalSid: sendResult?.sid || null,
      deliveryStatus: sendResult?.success === false ? 'failed' : 'sent',
      error: sendResult?.error || null,
      draftState: sendResult?.success === false ? 'failed' : 'approved_sent',
    });

    const activity = await ActivityLog.create({
      leadId: lead.id,
      leadName: lead.name,
      action: sendResult?.success === false ? 'needs_human' : 'replied',
      channel: lead.channel,
      description: sendResult?.success === false
        ? `Approved draft delivery failed: ${sendResult.error || 'unknown error'}`
        : `Approved AI draft and sent to ${lead.name}`,
      sentByAI: false,
    });

    const io = req.app.get('io');
    emit(io, 'message:sent', {
      ...message,
      leadName: lead.name,
      leadStatus: lead.status,
      icon: sendResult?.success === false ? '⚠️' : '✅',
    });
    emit(io, 'agent:action', activity);

    return res.json({ message, activity, sendResult });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
