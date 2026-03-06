const express = require('express');
const Lead = require('../models/Lead');
const ActivityLog = require('../models/ActivityLog');
const { requireAuth } = require('../middleware/auth');
const { asInteger, asEnum, asString, asPhone, asEmail } = require('../utils/validate');

const router = express.Router();

router.get('/leads', requireAuth, async (_req, res) => {
  const leads = await Lead.allWithLastMessage();

  const grouped = {
    new: leads.filter((lead) => lead.status === 'new'),
    qualified: leads.filter((lead) => lead.status === 'qualified'),
    booked: leads.filter((lead) => lead.status === 'booked'),
    closed: leads.filter((lead) => lead.status === 'closed'),
    escalated: leads.filter((lead) => lead.status === 'escalated'),
  };

  return res.json({ leads, grouped });
});

router.get('/leads/:id', requireAuth, async (req, res) => {
  try {
    const leadId = asInteger(req.params.id, 'id', { required: true, min: 1 });
    const lead = await Lead.getById(leadId);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    return res.json({ lead });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to load lead' });
  }
});

router.patch('/leads/:id', requireAuth, async (req, res) => {
  try {
    const leadId = asInteger(req.params.id, 'id', { required: true, min: 1 });
    const current = await Lead.getById(leadId);
    if (!current) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const updates = {
      name: asString(req.body?.name, 'name', { max: 150 }),
      phone: asPhone(req.body?.phone, 'phone'),
      email: asEmail(req.body?.email, 'email'),
      status: asEnum(req.body?.status, 'status', ['new', 'qualified', 'booked', 'closed', 'escalated']),
      budget: asString(req.body?.budget, 'budget', { max: 120 }),
      timeline: asString(req.body?.timeline, 'timeline', { max: 120 }),
      location: asString(req.body?.location, 'location', { max: 240 }),
      propertyType: asString(req.body?.propertyType, 'propertyType', { max: 120 }),
      sentiment: asEnum(req.body?.sentiment, 'sentiment', ['positive', 'neutral', 'negative']),
      aiPaused: req.body?.aiPaused == null ? null : (req.body.aiPaused ? 1 : 0),
    };

    const lead = await Lead.update(leadId, updates);
    const io = req.app.get('io');

    io.emit('lead:updated', lead);

    if (current.status !== lead.status) {
      io.emit('lead:moved', {
        leadId: lead.id,
        lead,
        from: current.status,
        to: lead.status,
      });
    }

    return res.json({ lead });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to update lead' });
  }
});

router.post('/leads/:id/block', requireAuth, async (req, res) => {
  try {
    const leadId = asInteger(req.params.id, 'id', { required: true, min: 1 });
    const lead = await Lead.getById(leadId);
    if (!lead || !lead.phone) {
      return res.status(404).json({ error: 'Lead or phone not found' });
    }

    const reason = asString(req.body?.reason, 'reason', { max: 240 }) || 'Blocked by agent';
    await Lead.blockPhone(lead.phone, reason);

    const activity = await ActivityLog.create({
      leadId: lead.id,
      leadName: lead.name,
      action: 'needs_human',
      channel: lead.channel,
      description: `Blocked phone ${lead.phone} (${reason})`,
      sentByAI: false,
    });

    const io = req.app.get('io');
    io.emit('agent:action', activity);

    return res.json({ success: true, blockedPhone: lead.phone });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to block contact' });
  }
});

router.get('/blocked', requireAuth, async (_req, res) => {
  const items = await Lead.getBlocked();
  return res.json({ items });
});

router.post('/blocked', requireAuth, async (req, res) => {
  try {
    const phone = asPhone(req.body?.phone, 'phone', { required: true });
    const reason = asString(req.body?.reason, 'reason', { max: 240 }) || 'Blocked by agent';

    await Lead.blockPhone(phone, reason);
    const items = await Lead.getBlocked();
    return res.status(201).json({ success: true, items });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to add blocked contact' });
  }
});

router.post('/leads/:id/takeover', requireAuth, async (req, res) => {
  try {
    const leadId = asInteger(req.params.id, 'id', { required: true, min: 1 });
    const lead = await Lead.setAiPaused(leadId, true);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const activity = await ActivityLog.create({
      leadId: lead.id,
      leadName: lead.name,
      action: 'needs_human',
      channel: lead.channel,
      description: `Human took over ${lead.name}'s conversation`,
      sentByAI: false,
    });

    const io = req.app.get('io');
    io.emit('lead:updated', lead);
    io.emit('agent:action', activity);

    return res.json({ lead, activity });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to takeover lead' });
  }
});

router.post('/leads/:id/handback', requireAuth, async (req, res) => {
  try {
    const leadId = asInteger(req.params.id, 'id', { required: true, min: 1 });
    const lead = await Lead.setAiPaused(leadId, false);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const activity = await ActivityLog.create({
      leadId: lead.id,
      leadName: lead.name,
      action: 'replied',
      channel: lead.channel,
      description: `AI resumed conversation with ${lead.name}`,
      sentByAI: true,
    });

    const io = req.app.get('io');
    io.emit('lead:updated', lead);
    io.emit('agent:action', activity);

    return res.json({ lead, activity });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to hand back lead' });
  }
});

module.exports = router;
