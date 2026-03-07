const { getDb } = require('../db');

function mapColor(action) {
  if (action === 'booked') return 'blue';
  if (action === 'escalated') return 'yellow';
  if (action === 'needs_human') return 'red';
  if (action === 'followed_up') return 'red';
  return 'green';
}

function normalize(row) {
  if (!row) return row;

  const color = mapColor(row.action);

  return {
    ...row,
    color,
    type: row.action,
    message: row.description,
    createdAt: row.timestamp,
  };
}

function parseTimestamp(value) {
  if (!value) return null;

  const raw = String(value);
  if (raw.includes('T')) {
    const direct = new Date(raw);
    return Number.isNaN(direct.getTime()) ? null : direct;
  }

  const normalized = new Date(raw.replace(' ', 'T') + 'Z');
  return Number.isNaN(normalized.getTime()) ? null : normalized;
}

class ActivityLog {
  static async create(data) {
    const db = await getDb();
    let userId = data.userId || null;

    if (!userId && data.leadId) {
      const lead = await db.get('SELECT userId FROM leads WHERE id = ? LIMIT 1', [data.leadId]);
      userId = lead?.userId || null;
    }

    const result = await db.run(
      `INSERT INTO activity_log (leadId, userId, leadName, action, channel, description, sentByAI)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.leadId || null,
        userId,
        data.leadName || null,
        data.action || 'replied',
        data.channel || 'web',
        data.description || '',
        data.sentByAI ? 1 : 0,
      ]
    );

    return this.getById(result.lastID);
  }

  static async getById(id) {
    const db = await getDb();
    const row = await db.get('SELECT * FROM activity_log WHERE id = ?', [id]);
    return normalize(row);
  }

  static async recent(limit = 100, userId = null) {
    const db = await getDb();
    let rows;

    if (userId) {
      rows = await db.all(
        `SELECT a.*
         FROM activity_log a
         LEFT JOIN leads l ON l.id = a.leadId
         WHERE a.userId = ? OR (a.userId IS NULL AND l.userId = ?)
         ORDER BY a.timestamp DESC, a.id DESC
         LIMIT ?`,
        [userId, userId, limit]
      );
    } else {
      rows = await db.all(
        'SELECT * FROM activity_log ORDER BY timestamp DESC, id DESC LIMIT ?',
        [limit]
      );
    }

    return rows.map(normalize);
  }

  static async todayStats(userId = null) {
    const db = await getDb();
    let rows;

    if (userId) {
      rows = await db.all(
        `SELECT a.action, a.timestamp
         FROM activity_log a
         LEFT JOIN leads l ON l.id = a.leadId
         WHERE a.userId = ? OR (a.userId IS NULL AND l.userId = ?)
         ORDER BY a.timestamp DESC
         LIMIT 4000`,
        [userId, userId]
      );
    } else {
      rows = await db.all(
        'SELECT action, timestamp FROM activity_log ORDER BY timestamp DESC LIMIT 4000'
      );
    }

    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;

    let messagesProcessed = 0;
    let leadsQualified = 0;
    let bookingsMade = 0;

    for (const row of rows) {
      const parsed = parseTimestamp(row.timestamp);
      if (!parsed) continue;

      const rowKey = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(
        parsed.getDate()
      ).padStart(2, '0')}`;

      if (rowKey !== todayKey) continue;

      if (['replied', 'qualified', 'booked', 'escalated', 'followed_up', 'needs_human'].includes(row.action)) {
        messagesProcessed += 1;
      }
      if (row.action === 'qualified') leadsQualified += 1;
      if (row.action === 'booked') bookingsMade += 1;
    }

    return { messagesProcessed, leadsQualified, bookingsMade };
  }
}

module.exports = ActivityLog;
