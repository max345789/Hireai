const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getDb } = require('../db');

const router = express.Router();

const AGENTS = {
  salesbot: {
    id: 'salesbot',
    name: 'Aria',
    tagline: 'Qualifies leads & closes deals',
    description: 'Proactively qualifies inbound leads, extracts budget/timeline/location, and advances prospects through your pipeline with precision.',
    persona: 'You are Aria, a sharp and high-energy real estate sales assistant. Your goal is to quickly qualify leads, understand their needs, and move them toward booking a property viewing. Be direct, enthusiastic, and results-oriented.',
    icon: 'Zap',
    color: '#f97316',
    strengths: ['Lead qualification', 'Property matching', 'Pipeline management'],
    orchestratorBias: { prefer: ['qualify', 'reply'], threshold: 0.65 },
  },
  bookingbot: {
    id: 'bookingbot',
    name: 'Cal',
    tagline: 'Schedules viewings & manages calendar',
    description: 'Specializes in converting qualified leads into booked viewings. Handles all scheduling, confirmations, reminders, and calendar sync automatically.',
    persona: 'You are Cal, a specialist real estate scheduling assistant. Your primary goal is to book property viewings. When a lead shows any interest, guide them toward scheduling. Be warm, organized, and time-conscious.',
    icon: 'Calendar',
    color: '#3b82f6',
    strengths: ['Viewing bookings', 'Calendar sync', 'Appointment reminders'],
    orchestratorBias: { prefer: ['book_viewing', 'qualify'], threshold: 0.60 },
  },
  nurturebot: {
    id: 'nurturebot',
    name: 'Ivy',
    tagline: 'Re-engages & nurtures cold leads',
    description: 'Focuses on long-term lead nurturing, follow-up sequences, and re-engagement campaigns. Keeps cold leads warm until they\'re ready to buy.',
    persona: 'You are Ivy, a patient and empathetic real estate assistant specializing in long-term relationships. Your goal is to stay in touch with leads over time, provide value, and gently re-engage cold prospects when the time is right.',
    icon: 'Heart',
    color: '#8b5cf6',
    strengths: ['Follow-up sequences', 'Cold re-engagement', 'Long-term nurturing'],
    orchestratorBias: { prefer: ['followup', 'reply'], threshold: 0.55 },
  },
};

// GET /agent-selector — get current agent + all options
router.get('/agent-selector', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const user = await db.get('SELECT selectedAgent FROM users WHERE id = ?', [req.user.id]);
    const current = user?.selectedAgent || 'salesbot';

    return res.json({
      current,
      agent: AGENTS[current] || AGENTS.salesbot,
      agents: Object.values(AGENTS),
    });
  } catch (err) {
    console.error('[agentSelector] GET failed:', err.message);
    return res.status(500).json({ error: 'Failed to get agent' });
  }
});

// POST /agent-selector — select an agent
router.post('/agent-selector', requireAuth, async (req, res) => {
  try {
    const { agentId } = req.body || {};
    if (!AGENTS[agentId]) {
      return res.status(400).json({ error: 'Invalid agent ID. Choose: salesbot, bookingbot, nurturebot' });
    }

    const db = await getDb();
    await db.run(
      'UPDATE users SET selectedAgent = ?, agentPersonality = ? WHERE id = ?',
      [agentId, AGENTS[agentId].persona, req.user.id]
    );

    return res.json({
      success: true,
      current: agentId,
      agent: AGENTS[agentId],
    });
  } catch (err) {
    console.error('[agentSelector] POST failed:', err.message);
    return res.status(500).json({ error: 'Failed to select agent' });
  }
});

module.exports = router;
module.exports.AGENTS = AGENTS;
