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
    const result = await db.run(
      `INSERT INTO activity_log (leadId, leadName, action, channel, description, sentByAI)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.leadId || null,
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

  static async recent(limit = 100) {
    const db = await getDb();
    const rows = await db.all(
      'SELECT * FROM activity_log ORDER BY timestamp DESC, id DESC LIMIT ?',
      [limit]
    );
    return rows.map(normalize);
  }

  static async todayStats() {
    const db = await getDb();
    const rows = await db.all(
      'SELECT action, timestamp FROM activity_log ORDER BY timestamp DESC LIMIT 4000'
    );

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
