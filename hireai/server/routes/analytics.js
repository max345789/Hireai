const express = require('express');
const Message = require('../models/Message');
const ActivityLog = require('../models/ActivityLog');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { safeLimit } = require('../utils/validate');

const router = express.Router();

function parseIso(value, label) {
  if (!value) return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    const error = new Error(`${label} must be a valid ISO date`);
    error.status = 400;
    throw error;
  }
  return parsed.toISOString();
}

router.get('/analytics/today', requireAuth, async (_req, res) => {
  try {
    const messageCounts = await Message.todayChannelCounts(_req.user.id);
    const status = await ActivityLog.todayStats(_req.user.id);
    return res.json({
      whatsapp: messageCounts.whatsapp || 0,
      email: messageCounts.email || 0,
      web: messageCounts.web || 0,
      aiReplies: messageCounts.aiReplies || 0,
      qualified: status.leadsQualified || 0,
      booked: status.bookingsMade || 0,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/analytics/range', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const from = parseIso(req.query.from, 'from') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const to = parseIso(req.query.to, 'to') || new Date().toISOString();
    if (new Date(from).getTime() > new Date(to).getTime()) {
      return res.status(400).json({ error: 'from must be before to' });
    }

    const userId = req.user.id;
    const [msgStats, leadStats, bookingStats, hourlyActivity, channelBreakdown, dailyLeads, avgResponse] = await Promise.all([
      db.get(
        `SELECT COUNT(*) AS total, SUM(CASE WHEN sentByAI=1 THEN 1 ELSE 0 END) AS aiReplies,
                SUM(CASE WHEN direction='in' THEN 1 ELSE 0 END) AS inbound,
                SUM(CASE WHEN direction='out' THEN 1 ELSE 0 END) AS outbound
         FROM messages m
         JOIN leads l ON l.id = m.leadId
         WHERE m.timestamp BETWEEN ? AND ? AND l.userId = ?`,
        [from, to, userId]
      ),
      db.get(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN status='new' THEN 1 ELSE 0 END) AS new_leads,
                SUM(CASE WHEN status='qualified' THEN 1 ELSE 0 END) AS qualified,
                SUM(CASE WHEN status='booked' THEN 1 ELSE 0 END) AS booked,
                SUM(CASE WHEN status='closed' THEN 1 ELSE 0 END) AS closed,
                SUM(CASE WHEN status='escalated' THEN 1 ELSE 0 END) AS escalated
         FROM leads WHERE createdAt BETWEEN ? AND ? AND userId = ?`,
        [from, to, userId]
      ),
      db.get(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
                SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) AS cancelled
         FROM bookings b
         JOIN leads l ON l.id = b.leadId
         WHERE b.createdAt BETWEEN ? AND ? AND l.userId = ?`,
        [from, to, userId]
      ),
      db.all(
        `SELECT strftime('%H', m.timestamp) AS hour, COUNT(*) AS count
         FROM messages m
         JOIN leads l ON l.id = m.leadId
         WHERE m.timestamp BETWEEN ? AND ? AND l.userId = ?
         GROUP BY hour ORDER BY hour`,
        [from, to, userId]
      ),
      db.all(
        `SELECT m.channel AS channel, COUNT(*) AS count
         FROM messages m
         JOIN leads l ON l.id = m.leadId
         WHERE m.timestamp BETWEEN ? AND ? AND m.direction='in' AND l.userId = ?
         GROUP BY m.channel`,
        [from, to, userId]
      ),
      db.all(
        `SELECT date(createdAt) AS day, COUNT(*) AS count
         FROM leads WHERE createdAt BETWEEN ? AND ? AND userId = ?
         GROUP BY day ORDER BY day`,
        [from, to, userId]
      ),
      db.get(
        `SELECT AVG(diff_seconds)/60.0 AS avgMinutes FROM (
           SELECT (strftime('%s', out.timestamp)-strftime('%s', in_.timestamp)) AS diff_seconds
           FROM messages in_
           JOIN leads lead_scope ON lead_scope.id = in_.leadId AND lead_scope.userId = ?
           JOIN messages out ON out.leadId=in_.leadId AND out.direction='out'
             AND out.sentByAI=1 AND out.timestamp>in_.timestamp
           WHERE in_.direction='in' AND in_.timestamp BETWEEN ? AND ?
           GROUP BY in_.id HAVING MIN(out.timestamp)
         )`,
        [userId, from, to]
      ),
    ]);

    const heatmap = Array.from({ length: 24 }, (_, i) => {
      const found = hourlyActivity.find((r) => Number(r.hour) === i);
      return { hour: i, count: found ? found.count : 0 };
    });

    const hoursSaved = Math.round((msgStats.aiReplies || 0) * 5 / 60 * 10) / 10;
    const valueSaved = Math.round(hoursSaved * 20);

    return res.json({ period: { from, to }, messages: msgStats, leads: leadStats, bookings: bookingStats, heatmap, channelBreakdown, dailyLeads, avgResponseMinutes: avgResponse?.avgMinutes ? Math.round(avgResponse.avgMinutes * 10) / 10 : null, hoursSaved, valueSaved });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/analytics/followups', requireAuth, async (_req, res) => {
  try {
    const db = await getDb();
    const limit = safeLimit(_req.query.limit, 100, 300);
    const userId = _req.user.id;
    const log = await db.all(
      `SELECT f.*
       FROM followup_log f
       JOIN leads l ON l.id = f.leadId
       WHERE l.userId = ?
       ORDER BY f.sentAt DESC
       LIMIT ?`,
      [userId, limit]
    );
    const stats = await db.get(
      `SELECT COUNT(*) AS total, COUNT(DISTINCT leadId) AS uniqueLeads,
              SUM(CASE WHEN sequenceStep=1 THEN 1 ELSE 0 END) AS step1,
              SUM(CASE WHEN sequenceStep=2 THEN 1 ELSE 0 END) AS step2,
              SUM(CASE WHEN sequenceStep=3 THEN 1 ELSE 0 END) AS step3
       FROM followup_log f
       JOIN leads l ON l.id = f.leadId
       WHERE l.userId = ?`,
      [userId]
    );
    return res.json({ log, stats });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
