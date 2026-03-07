const express = require('express');
const WidgetSession = require('../models/WidgetSession');
const Lead = require('../models/Lead');
const Message = require('../models/Message');
const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');
const { processInboundEvent } = require('../services/conversationPipeline');
const { idempotency } = require('../middleware/idempotency');
const { asString, asInteger } = require('../utils/validate');
const { resolveWidgetUser, resolveWidgetUserByWidgetId } = require('../services/userIntegrationResolver');

const router = express.Router();

function emit(io, event, payload) {
  if (io) io.emit(event, payload);
}

function sessionAccessDenied(res) {
  return res.status(403).json({ error: 'Invalid widget session credentials' });
}

async function resolveSession(sessionId) {
  if (!sessionId) return null;

  const session = await WidgetSession.findBySessionId(sessionId);
  if (!session) return null;

  const lead = session.leadId ? await Lead.getById(session.leadId) : null;
  if (!lead) return null;

  return { session, lead };
}

async function resolveWidgetUserId({ widgetId, agencyId, agencyName } = {}) {
  // Prefer widgetId (unique per account) — most reliable
  if (widgetId) {
    const byWidgetId = await resolveWidgetUserByWidgetId(widgetId);
    if (byWidgetId) return byWidgetId.id;
  }

  // Fallback: legacy agencyId/agencyName resolution
  const scoped = await resolveWidgetUser({ agencyId, agencyName });
  if (scoped) return scoped.id;

  return null;
}

function sessionMatchesRequest(session, { widgetId, agencyId, accessToken }) {
  if (!session || !accessToken || session.accessToken !== accessToken) return false;
  if (widgetId) {
    return session.agencyId === widgetId;
  }
  if (agencyId) {
    return session.agencyId === agencyId;
  }
  return false;
}

router.post('/widget/session', async (req, res) => {
  try {
    const io = req.app.get('io');
    const sessionId = asString(req.body?.sessionId, 'sessionId', { max: 120 });
    const widgetId = asString(req.body?.widgetId, 'widgetId', { max: 80 });
    const agencyId = asString(req.body?.agencyId, 'agencyId', { max: 120 }) || process.env.AGENCY_ID || 'agency_001';
    const agencyName = asString(req.body?.agencyName, 'agencyName', { max: 120 }) || 'Dream Properties';
    const accessToken = asString(req.body?.accessToken, 'accessToken', { max: 120 });
    const greeting =
      asString(req.body?.greeting, 'greeting', { max: 600 }) ||
      'Hi! Looking for your dream property? I can help 24/7 🏠';
    const visitorName = asString(req.body?.visitorName, 'visitorName', { max: 120 }) || 'Website Visitor';
    const userId = await resolveWidgetUserId({ widgetId, agencyId, agencyName });

    if (!userId) {
      return res.status(400).json({ error: 'widgetId or mapped agency details are required' });
    }

    if (sessionId) {
      const existing = await resolveSession(sessionId);
      if (existing) {
        if (!sessionMatchesRequest(existing.session, { widgetId, agencyId, accessToken })) {
          return sessionAccessDenied(res);
        }
        await WidgetSession.touch(existing.session.sessionId);
        const messages = await Message.getByLeadId(existing.lead.id);
        return res.json({
          sessionId: existing.session.sessionId,
          accessToken: existing.session.accessToken,
          agencyId,
          agencyName,
          leadId: existing.lead.id,
          messages,
        });
      }
    }

    const lead = await Lead.create({
      userId,
      name: visitorName,
      channel: 'web',
      status: 'new',
      sentiment: 'neutral',
    });

    const widgetSession = await WidgetSession.create({
      leadId: lead.id,
      agencyId: widgetId || agencyId,
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
      userId: lead.userId || userId || null,
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
      accessToken: widgetSession.accessToken,
      agencyId,
      agencyName,
      leadId: lead.id,
      messages: [welcomeMessage],
    });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    console.error('widget session failed', error);
    return res.status(500).json({ error: 'Failed to create widget session' });
  }
});

router.post('/widget/message', idempotency({ scope: (req) => `widget:message:${req.body?.sessionId || 'missing'}` }), async (req, res) => {
  try {
    const io = req.app.get('io');
    const sessionId = asString(req.body?.sessionId, 'sessionId', { required: true, max: 120 });
    const message = asString(req.body?.message, 'message', { required: true, min: 1, max: 5000 });
    const visitorName = asString(req.body?.visitorName, 'visitorName', { max: 120 });
    const accessToken = asString(req.body?.accessToken, 'accessToken', { required: true, max: 120 });
    const widgetId = asString(req.body?.widgetId, 'widgetId', { max: 80 });
    const agencyId = asString(req.body?.agencyId, 'agencyId', { max: 120 });

    const resolved = await resolveSession(sessionId);
    if (!resolved) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!sessionMatchesRequest(resolved.session, { widgetId, agencyId, accessToken })) {
      return sessionAccessDenied(res);
    }

    const userId = await resolveWidgetUserId({
      widgetId: widgetId || resolved.session?.agencyId || null,
      agencyId: resolved.session?.agencyId || null,
      agencyName: null,
    });

    await WidgetSession.touch(sessionId);

    const lead = await Lead.update(resolved.lead.id, {
      userId: resolved.lead.userId || userId,
      name: visitorName || resolved.lead.name,
      channel: 'web',
    });

    const result = await processInboundEvent({
      io,
      lead,
      userId: lead.userId || userId,
      channel: 'web',
      message,
      metadata: { source: 'widget' },
    });

    return res.json({
      queued: true,
      response: result?.outMessage?.content || null,
      blocked: result?.blocked || false,
      reason: result?.reason || null,
      lead: result.lead || lead,
    });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    console.error('widget message failed', error);
    return res.status(500).json({ error: 'Failed to process widget message' });
  }
});

router.get('/widget/messages/:sid', async (req, res) => {
  try {
    const sessionId = asString(req.params.sid, 'sid', { required: true, min: 8, max: 120 });
    const sinceId = asInteger(req.query.since, 'since', { min: 0, fallback: 0 });
    const accessToken = asString(req.query.accessToken, 'accessToken', { required: true, max: 120 });
    const widgetId = asString(req.query.widgetId, 'widgetId', { max: 80 });
    const agencyId = asString(req.query.agencyId, 'agencyId', { max: 120 });

    const resolved = await resolveSession(sessionId);
    if (!resolved) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!sessionMatchesRequest(resolved.session, { widgetId, agencyId, accessToken })) {
      return sessionAccessDenied(res);
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
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    console.error('widget messages failed', error);
    return res.status(500).json({ error: 'Failed to load widget messages' });
  }
});

module.exports = router;
