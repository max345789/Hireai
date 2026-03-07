const express = require('express');
const Lead = require('../models/Lead');
const ActivityLog = require('../models/ActivityLog');
const { requireAuth } = require('../middleware/auth');
const { asInteger, asEnum, asString, asPhone, asEmail } = require('../utils/validate');
const { calculateLeadScore } = require('../services/leadScoring');
const { getDb } = require('../db');

const router = express.Router();

router.get('/leads', requireAuth, async (req, res) => {
  const leads = await Lead.allWithLastMessage(req.user.id);

  // Auto-compute lead scores if not set
  const scoredLeads = leads.map((lead) => ({
    ...lead,
    leadScore: lead.leadScore != null ? lead.leadScore : calculateLeadScore(lead),
  }));

  const grouped = {
    new: scoredLeads.filter((lead) => lead.status === 'new' && !lead.archived),
    qualified: scoredLeads.filter((lead) => lead.status === 'qualified' && !lead.archived),
    booked: scoredLeads.filter((lead) => lead.status === 'booked' && !lead.archived),
    closed: scoredLeads.filter((lead) => lead.status === 'closed' && !lead.archived),
    escalated: scoredLeads.filter((lead) => lead.status === 'escalated' && !lead.archived),
  };

  return res.json({ leads: scoredLeads, grouped });
});

// Bulk actions: archive, status change, export
router.post('/leads/bulk', requireAuth, async (req, res) => {
  try {
    const { action, leadIds } = req.body || {};
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ error: 'leadIds array required' });
    }

    const db = await getDb();

    if (action === 'archive') {
      const placeholders = leadIds.map(() => '?').join(',');
      await db.run(`UPDATE leads SET archived = 1 WHERE id IN (${placeholders}) AND userId = ?`, [...leadIds, req.user.id]);
      return res.json({ success: true, affected: leadIds.length });
    }

    if (action === 'unarchive') {
      const placeholders = leadIds.map(() => '?').join(',');
      await db.run(`UPDATE leads SET archived = 0 WHERE id IN (${placeholders}) AND userId = ?`, [...leadIds, req.user.id]);
      return res.json({ success: true, affected: leadIds.length });
    }

    if (['new', 'qualified', 'booked', 'closed', 'escalated'].includes(action)) {
      const placeholders = leadIds.map(() => '?').join(',');
      await db.run(`UPDATE leads SET status = ? WHERE id IN (${placeholders}) AND userId = ?`, [action, ...leadIds, req.user.id]);
      return res.json({ success: true, affected: leadIds.length });
    }

    return res.status(400).json({ error: 'Unknown bulk action' });
  } catch (err) {
    console.error('[leads/bulk] failed:', err.message);
    return res.status(500).json({ error: 'Bulk action failed' });
  }
});

// CSV export
router.get('/leads/export.csv', requireAuth, async (req, res) => {
  try {
    const leads = await Lead.allWithLastMessage(req.user.id);

    const header = 'ID,Name,Phone,Email,Channel,Status,Budget,Timeline,Location,PropertyType,Sentiment,Urgency,Score,CreatedAt\n';
    const rows = leads.map((lead) => {
      const score = lead.leadScore != null ? lead.leadScore : calculateLeadScore(lead);
      return [
        lead.id,
        `"${(lead.name || '').replace(/"/g, '""')}"`,
        lead.phone || '',
        lead.email || '',
        lead.channel || '',
        lead.status || '',
        `"${(lead.budget || '').replace(/"/g, '""')}"`,
        `"${(lead.timeline || '').replace(/"/g, '""')}"`,
        `"${(lead.location || '').replace(/"/g, '""')}"`,
        lead.propertyType || '',
        lead.sentiment || '',
        lead.urgency || '',
        score,
        lead.createdAt || '',
      ].join(',');
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
    return res.send(header + rows);
  } catch (err) {
    console.error('[leads/export] failed:', err.message);
    return res.status(500).json({ error: 'Export failed' });
  }
});

router.get('/leads/:id', requireAuth, async (req, res) => {
  try {
    const leadId = asInteger(req.params.id, 'id', { required: true, min: 1 });
    const lead = await Lead.getById(leadId);
    if (!lead || (lead.userId && Number(lead.userId) !== Number(req.user.id))) {
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
    if (!current || (current.userId && Number(current.userId) !== Number(req.user.id))) {
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
    if (!lead || (lead.userId && Number(lead.userId) !== Number(req.user.id)) || !lead.phone) {
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
    if (!lead || (lead.userId && Number(lead.userId) !== Number(req.user.id))) {
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
    if (!lead || (lead.userId && Number(lead.userId) !== Number(req.user.id))) {
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
