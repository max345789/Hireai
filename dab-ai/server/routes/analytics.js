const express = require('express');
const Message = require('../models/Message');
const ActivityLog = require('../models/ActivityLog');
const { getDb, isPostgres } = require('../db');
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
    const pg = isPostgres();
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
        `SELECT ${pg ? 'EXTRACT(HOUR FROM m.timestamp)' : "strftime('%H', datetime(m.timestamp))"} AS hour, COUNT(*) AS count
         FROM messages m
         JOIN leads l ON l.id = m.leadId
         WHERE ${pg ? 'm.timestamp BETWEEN ? AND ?' : 'datetime(m.timestamp) BETWEEN datetime(?) AND datetime(?)'} AND l.userId = ?
         GROUP BY hour ORDER BY hour`,
        [from, to, userId]
      ),
      db.all(
        `SELECT m.channel AS channel, COUNT(*) AS count
         FROM messages m
         JOIN leads l ON l.id = m.leadId
         WHERE ${pg ? 'm.timestamp BETWEEN ? AND ?' : 'datetime(m.timestamp) BETWEEN datetime(?) AND datetime(?)'} AND m.direction='in' AND l.userId = ?
         GROUP BY m.channel`,
        [from, to, userId]
      ),
      db.all(
        `SELECT ${pg ? 'DATE(createdAt)' : 'date(datetime(createdAt))'} AS day, COUNT(*) AS count
         FROM leads WHERE ${pg ? 'createdAt BETWEEN ? AND ?' : 'datetime(createdAt) BETWEEN datetime(?) AND datetime(?)'} AND userId = ?
         GROUP BY day ORDER BY day`,
        [from, to, userId]
      ),
      db.get(
        `SELECT AVG(diff_seconds)/60.0 AS avgMinutes
         FROM (
           SELECT (
             ${pg ? 'EXTRACT(EPOCH FROM (' : "strftime('%s', ("}
               SELECT MIN(${pg ? 'out.timestamp' : 'datetime(out.timestamp)'})
               FROM messages out
               WHERE out.leadId = in_.leadId
                 AND out.direction = 'out'
                 AND out.sentByAI = 1
                 AND ${pg ? 'out.timestamp > in_.timestamp' : 'datetime(out.timestamp) > datetime(in_.timestamp)'}
             ${pg ? ')) - EXTRACT(EPOCH FROM in_.timestamp)' : ")) - strftime('%s', datetime(in_.timestamp))"}
           ) AS diff_seconds
           FROM messages in_
           JOIN leads lead_scope ON lead_scope.id = in_.leadId AND lead_scope.userId = ?
           WHERE in_.direction = 'in'
             AND ${pg ? 'in_.timestamp BETWEEN ? AND ?' : 'datetime(in_.timestamp) BETWEEN datetime(?) AND datetime(?)'}
         )
         WHERE diff_seconds IS NOT NULL`,
        [userId, from, to]
      ),
    ]);

    const heatmap = Array.from({ length: 24 }, (_, i) => {
      const found = hourlyActivity.find((r) => Number(r.hour) === i);
      return { hour: i, count: found ? Number(found.count) : 0 };
    });

    const normalizedMessageStats = {
      total: Number(msgStats?.total || 0),
      aiReplies: Number(msgStats?.aiReplies || 0),
      inbound: Number(msgStats?.inbound || 0),
      outbound: Number(msgStats?.outbound || 0),
    };
    const normalizedLeadStats = {
      total: Number(leadStats?.total || 0),
      new_leads: Number(leadStats?.new_leads || 0),
      qualified: Number(leadStats?.qualified || 0),
      booked: Number(leadStats?.booked || 0),
      closed: Number(leadStats?.closed || 0),
      escalated: Number(leadStats?.escalated || 0),
    };
    const normalizedBookingStats = {
      total: Number(bookingStats?.total || 0),
      completed: Number(bookingStats?.completed || 0),
      cancelled: Number(bookingStats?.cancelled || 0),
    };

    const hoursSaved = Math.round((normalizedMessageStats.aiReplies || 0) * 5 / 60 * 10) / 10;
    const valueSaved = Math.round(hoursSaved * 20);

    return res.json({
      period: { from, to },
      messages: normalizedMessageStats,
      leads: normalizedLeadStats,
      bookings: normalizedBookingStats,
      heatmap,
      channelBreakdown: (channelBreakdown || []).map((item) => ({
        ...item,
        count: Number(item.count || 0),
      })),
      dailyLeads: (dailyLeads || []).map((item) => ({
        ...item,
        count: Number(item.count || 0),
      })),
      avgResponseMinutes: avgResponse?.avgMinutes ? Math.round(avgResponse.avgMinutes * 10) / 10 : null,
      hoursSaved,
      valueSaved,
    });
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
