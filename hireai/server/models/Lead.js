const { getDb } = require('../db');

class Lead {
  static async create(data) {
    const db = await getDb();
    const result = await db.run(
      `INSERT INTO leads (name, phone, email, sessionId, channel, status, budget, timeline, location, propertyType, sentiment, aiPaused)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name || 'Unknown Lead',
        data.phone || null,
        data.email || null,
        data.sessionId || null,
        data.channel || 'webchat',
        data.status || 'new',
        data.budget || null,
        data.timeline || null,
        data.location || null,
        data.propertyType || null,
        data.sentiment || 'neutral',
        data.aiPaused ? 1 : 0,
      ]
    );

    return this.getById(result.lastID);
  }

  static async getById(id) {
    const db = await getDb();
    return db.get('SELECT * FROM leads WHERE id = ?', [id]);
  }

  static async findBySessionId(sessionId) {
    const db = await getDb();
    return db.get('SELECT * FROM leads WHERE sessionId = ? ORDER BY id DESC LIMIT 1', [sessionId]);
  }

  static async findByContact({ phone, email, channel }) {
    const db = await getDb();

    if (phone) {
      const byPhone = await db.get(
        channel
          ? 'SELECT * FROM leads WHERE phone = ? AND channel = ? ORDER BY id DESC LIMIT 1'
          : 'SELECT * FROM leads WHERE phone = ? ORDER BY id DESC LIMIT 1',
        channel ? [phone, channel] : [phone]
      );
      if (byPhone) return byPhone;
    }

    if (email) {
      return db.get(
        channel
          ? 'SELECT * FROM leads WHERE email = ? AND channel = ? ORDER BY id DESC LIMIT 1'
          : 'SELECT * FROM leads WHERE email = ? ORDER BY id DESC LIMIT 1',
        channel ? [email, channel] : [email]
      );
    }

    return null;
  }

  static async allWithLastMessage() {
    const db = await getDb();
    return db.all(
      `SELECT
         l.*,
         m.content AS lastMessage,
         m.timestamp AS lastMessageAt,
         m.deliveryStatus AS lastMessageDeliveryStatus
       FROM leads l
       LEFT JOIN messages m ON m.id = (
         SELECT id FROM messages WHERE leadId = l.id ORDER BY timestamp DESC, id DESC LIMIT 1
       )
       ORDER BY COALESCE(m.timestamp, l.createdAt) DESC`
    );
  }

  static async update(id, updates) {
    const db = await getDb();
    const current = await this.getById(id);
    if (!current) return null;

    const next = {
      name: updates.name ?? current.name,
      phone: updates.phone ?? current.phone,
      email: updates.email ?? current.email,
      sessionId: updates.sessionId ?? current.sessionId,
      channel: updates.channel ?? current.channel,
      status: updates.status ?? current.status,
      budget: updates.budget ?? current.budget,
      timeline: updates.timeline ?? current.timeline,
      location: updates.location ?? current.location,
      propertyType: updates.propertyType ?? current.propertyType,
      sentiment: updates.sentiment ?? current.sentiment,
      aiPaused: updates.aiPaused ?? current.aiPaused,
    };

    await db.run(
      `UPDATE leads
       SET name = ?, phone = ?, email = ?, sessionId = ?, channel = ?, status = ?, budget = ?, timeline = ?, location = ?, propertyType = ?, sentiment = ?, aiPaused = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        next.name,
        next.phone,
        next.email,
        next.sessionId,
        next.channel,
        next.status,
        next.budget,
        next.timeline,
        next.location,
        next.propertyType,
        next.sentiment,
        next.aiPaused,
        id,
      ]
    );

    return this.getById(id);
  }

  static async setAiPaused(id, paused) {
    return this.update(id, { aiPaused: paused ? 1 : 0 });
  }

  static async blockPhone(phone, reason = null) {
    const db = await getDb();
    await db.run(
      `INSERT INTO blocked_contacts (phone, reason)
       VALUES (?, ?)
       ON CONFLICT(phone) DO UPDATE SET reason = excluded.reason`,
      [phone, reason]
    );
  }

  static async getBlocked() {
    const db = await getDb();
    return db.all('SELECT * FROM blocked_contacts ORDER BY createdAt DESC, id DESC');
  }

  static async unblockPhone(phone) {
    const db = await getDb();
    await db.run('DELETE FROM blocked_contacts WHERE phone = ?', [phone]);
  }

  static async isBlocked(phone) {
    const db = await getDb();
    if (!phone) return false;
    const row = await db.get('SELECT id FROM blocked_contacts WHERE phone = ? LIMIT 1', [phone]);
    return Boolean(row);
  }
}

module.exports = Lead;
