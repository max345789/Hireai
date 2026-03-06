const express = require('express');
const Lead = require('../models/Lead');
const ActivityLog = require('../models/ActivityLog');
const { requireAuth } = require('../middleware/auth');

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
  const lead = await Lead.getById(req.params.id);
  if (!lead) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  return res.json({ lead });
});

router.patch('/leads/:id', requireAuth, async (req, res) => {
  const current = await Lead.getById(req.params.id);
  if (!current) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  const lead = await Lead.update(req.params.id, req.body || {});
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
});

router.post('/leads/:id/block', requireAuth, async (req, res) => {
  const lead = await Lead.getById(req.params.id);
  if (!lead || !lead.phone) {
    return res.status(404).json({ error: 'Lead or phone not found' });
  }

  const reason = req.body?.reason || 'Blocked by agent';
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
});

router.get('/blocked', requireAuth, async (_req, res) => {
  const items = await Lead.getBlocked();
  return res.json({ items });
});

router.post('/blocked', requireAuth, async (req, res) => {
  const phone = req.body?.phone ? String(req.body.phone).trim() : null;
  const reason = req.body?.reason || 'Blocked by agent';

  if (!phone) {
    return res.status(400).json({ error: 'phone is required' });
  }

  await Lead.blockPhone(phone, reason);
  const items = await Lead.getBlocked();
  return res.status(201).json({ success: true, items });
});

router.post('/leads/:id/takeover', requireAuth, async (req, res) => {
  const lead = await Lead.setAiPaused(req.params.id, true);
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
});

router.post('/leads/:id/handback', requireAuth, async (req, res) => {
  const lead = await Lead.setAiPaused(req.params.id, false);
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
});

module.exports = router;
