const express = require('express');
const WidgetSession = require('../models/WidgetSession');
const Lead = require('../models/Lead');
const Message = require('../models/Message');
const ActivityLog = require('../models/ActivityLog');
const { processMessage } = require('../services/agentBrain');
const { validateInbound } = require('../services/channelGuard');

const router = express.Router();

function emit(io, event, payload) {
  if (io) io.emit(event, payload);
}

async function resolveSession(sessionId) {
  if (!sessionId) return null;

  const session = await WidgetSession.findBySessionId(sessionId);
  if (!session) return null;

  const lead = session.leadId ? await Lead.getById(session.leadId) : null;
  if (!lead) return null;

  return { session, lead };
}

router.post('/widget/session', async (req, res) => {
  try {
    const io = req.app.get('io');
    const {
      sessionId,
      agencyId = process.env.AGENCY_ID || 'agency_001',
      agencyName = 'Dream Properties',
      greeting = 'Hi! Looking for your dream property? I can help 24/7 🏠',
      visitorName = 'Website Visitor',
    } = req.body || {};

    if (sessionId) {
      const existing = await resolveSession(sessionId);
      if (existing) {
        await WidgetSession.touch(existing.session.sessionId);
        const messages = await Message.getByLeadId(existing.lead.id);
        return res.json({
          sessionId: existing.session.sessionId,
          agencyId,
          agencyName,
          leadId: existing.lead.id,
          messages,
        });
      }
    }

    const lead = await Lead.create({
      name: visitorName,
      channel: 'web',
      status: 'new',
      sentiment: 'neutral',
    });

    const widgetSession = await WidgetSession.create({
      leadId: lead.id,
      agencyId,
    });

    await Lead.update(lead.id, { sessionId: widgetSession.sessionId, channel: 'web' });

    const welcomeMessage = await Message.create({
      leadId: lead.id,
      direction: 'out',
      channel: 'web',
      content: greeting,
      sentByAI: true,
      deliveryStatus: 'sent',
      metadata: { source: 'widget_greeting' },
    });

    const activity = await ActivityLog.create({
      leadId: lead.id,
      leadName: lead.name,
      action: 'replied',
      channel: 'web',
      description: `New web chat session started for ${lead.name}`,
      sentByAI: true,
    });

    emit(io, 'lead:updated', await Lead.getById(lead.id));
    emit(io, 'message:sent', {
      ...welcomeMessage,
      leadName: lead.name,
      leadStatus: 'new',
      icon: '🤖',
    });
    emit(io, 'agent:action', activity);

    return res.status(201).json({
      sessionId: widgetSession.sessionId,
      agencyId,
      agencyName,
      leadId: lead.id,
      messages: [welcomeMessage],
    });
  } catch (error) {
    console.error('widget session failed', error);
    return res.status(500).json({ error: 'Failed to create widget session' });
  }
});

router.post('/widget/message', async (req, res) => {
  try {
    const io = req.app.get('io');
    const { sessionId, message, visitorName } = req.body || {};

    if (!sessionId || !message) {
      return res.status(400).json({ error: 'sessionId and message are required' });
    }

    const resolved = await resolveSession(sessionId);
    if (!resolved) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await WidgetSession.touch(sessionId);

    const lead = await Lead.update(resolved.lead.id, {
      name: visitorName || resolved.lead.name,
      channel: 'web',
    });

    const guard = await validateInbound({ lead, phone: null, content: message });
    if (!guard.ok) {
      return res.status(429).json({ error: `Message blocked: ${guard.reason}` });
    }

    const inMessage = await Message.create({
      leadId: lead.id,
      direction: 'in',
      channel: 'web',
      content: message,
      sentByAI: false,
      deliveryStatus: 'received',
      metadata: { source: 'widget' },
    });

    emit(io, 'message:new', {
      ...inMessage,
      leadName: lead.name,
      leadStatus: lead.status,
      icon: '👤',
    });

    if (lead.aiPaused) {
      const activity = await ActivityLog.create({
        leadId: lead.id,
        leadName: lead.name,
        action: 'needs_human',
        channel: 'web',
        description: `Web chat message from ${lead.name} while takeover is active`,
        sentByAI: false,
      });
      emit(io, 'agent:action', activity);

      return res.json({
        queued: true,
        paused: true,
      });
    }

    const history = await Message.getByLeadId(lead.id);
    const result = await processMessage(message, lead, history.slice(-10), {
      io,
      channel: 'web',
    });

    const responseMessage = result?.outMessage?.content || null;

    return res.json({
      queued: true,
      response: responseMessage,
      lead: result.lead,
    });
  } catch (error) {
    console.error('widget message failed', error);
    return res.status(500).json({ error: 'Failed to process widget message' });
  }
});

router.get('/widget/messages/:sid', async (req, res) => {
  try {
    const sessionId = req.params.sid;
    const sinceId = Number(req.query.since || 0);

    const resolved = await resolveSession(sessionId);
    if (!resolved) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await WidgetSession.touch(sessionId);

    const messages = await Message.getByLeadId(resolved.lead.id, {
      sinceId,
    });

    return res.json({
      sessionId,
      leadId: resolved.lead.id,
      messages,
    });
  } catch (error) {
    console.error('widget messages failed', error);
    return res.status(500).json({ error: 'Failed to load widget messages' });
  }
});

module.exports = router;
