const { getDb } = require('../db');

class Message {
  static async create(data) {
    const db = await getDb();
    const result = await db.run(
      `INSERT INTO messages (leadId, direction, channel, content, sentByAI, externalSid, deliveryStatus, error, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.leadId,
        data.direction,
        data.channel,
        data.content,
        data.sentByAI ? 1 : 0,
        data.externalSid || null,
        data.deliveryStatus || 'sent',
        data.error || null,
        data.metadata ? JSON.stringify(data.metadata) : null,
      ]
    );

    return this.getById(result.lastID);
  }

  static async getById(id) {
    const db = await getDb();
    return db.get('SELECT * FROM messages WHERE id = ?', [id]);
  }

  static async updateDelivery(id, { externalSid, deliveryStatus, error }) {
    const db = await getDb();
    await db.run(
      `UPDATE messages
       SET externalSid = COALESCE(?, externalSid), deliveryStatus = COALESCE(?, deliveryStatus), error = COALESCE(?, error)
       WHERE id = ?`,
      [externalSid || null, deliveryStatus || null, error || null, id]
    );
    return this.getById(id);
  }

  static async getByLeadId(leadId, options = {}) {
    const db = await getDb();
    const sinceId = Number(options.sinceId || 0);

    if (sinceId > 0) {
      return db.all(
        'SELECT * FROM messages WHERE leadId = ? AND id > ? ORDER BY timestamp ASC, id ASC',
        [leadId, sinceId]
      );
    }

    return db.all(
      'SELECT * FROM messages WHERE leadId = ? ORDER BY timestamp ASC, id ASC',
      [leadId]
    );
  }

  static async getLatestInboundByLead(leadId) {
    const db = await getDb();
    return db.get(
      `SELECT * FROM messages
       WHERE leadId = ? AND direction = 'in'
       ORDER BY timestamp DESC, id DESC LIMIT 1`,
      [leadId]
    );
  }

  static async recentFeed(limit = 80) {
    const db = await getDb();
    return db.all(
      `SELECT
         m.*,
         l.name AS leadName,
         l.status AS leadStatus,
         l.aiPaused AS leadAiPaused,
         l.sentiment AS leadSentiment
       FROM messages m
       JOIN leads l ON l.id = m.leadId
       ORDER BY m.timestamp DESC, m.id DESC
       LIMIT ?`,
      [limit]
    );
  }

  static async todayChannelCounts() {
    const db = await getDb();
    const rows = await db.all(
      `SELECT channel, direction, sentByAI, timestamp
       FROM messages
       ORDER BY timestamp DESC LIMIT 8000`
    );

    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;

    const map = { whatsapp: 0, email: 0, web: 0, aiReplies: 0 };

    for (const row of rows) {
      const parsed = String(row.timestamp).includes('T')
        ? new Date(String(row.timestamp))
        : new Date(String(row.timestamp).replace(' ', 'T') + 'Z');

      if (Number.isNaN(parsed.getTime())) continue;

      const rowKey = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(
        parsed.getDate()
      ).padStart(2, '0')}`;

      if (rowKey !== todayKey) continue;

      const channel = row.channel === 'webchat' ? 'web' : row.channel;
      if (row.direction === 'in' && channel in map) {
        map[channel] += 1;
      }
      if (row.direction === 'out' && Number(row.sentByAI) === 1) {
        map.aiReplies += 1;
      }
    }

    return map;
  }

  static async countForPhoneInWindow(phone, windowMs) {
    const db = await getDb();
    if (!phone) return 0;

    const rows = await db.all(
      `SELECT m.timestamp
       FROM messages m
       JOIN leads l ON l.id = m.leadId
       WHERE m.direction = 'in' AND l.phone = ?
       ORDER BY m.timestamp DESC LIMIT 200`,
      [phone]
    );

    const now = Date.now();
    const threshold = now - windowMs;

    let count = 0;
    for (const row of rows) {
      const parsed = new Date(String(row.timestamp).replace(' ', 'T') + 'Z').getTime();
      if (!Number.isNaN(parsed) && parsed >= threshold) {
        count += 1;
      }
    }

    return count;
  }
}

module.exports = Message;
