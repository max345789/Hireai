const { getDb } = require('../db');

class Lead {
  static async create(data) {
    const db = await getDb();
    const result = await db.run(
      `INSERT INTO leads (userId, name, phone, email, sessionId, channel, status, budget, timeline, location, propertyType, sentiment, intent, urgency, stageHistory, responseSlaMinutes, intelligenceSnapshot, aiPaused)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.userId || null,
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
        data.intent || null,
        data.urgency || null,
        data.stageHistory ? JSON.stringify(data.stageHistory) : null,
        data.responseSlaMinutes ?? null,
        data.intelligenceSnapshot ? JSON.stringify(data.intelligenceSnapshot) : null,
        data.aiPaused ? 1 : 0,
      ]
    );

    return this.getById(result.lastID);
  }

  static parseRow(row) {
    if (!row) return row;
    return {
      ...row,
      stageHistory: this.parseJson(row.stageHistory, []),
      intelligenceSnapshot: this.parseJson(row.intelligenceSnapshot, null),
    };
  }

  static parseJson(value, fallback) {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  static async getById(id) {
    const db = await getDb();
    const row = await db.get('SELECT * FROM leads WHERE id = ?', [id]);
    return this.parseRow(row);
  }

  static async findBySessionId(sessionId) {
    const db = await getDb();
    const row = await db.get('SELECT * FROM leads WHERE sessionId = ? ORDER BY id DESC LIMIT 1', [sessionId]);
    return this.parseRow(row);
  }

  static async findByContact({ phone, email, channel, userId = null }) {
    const db = await getDb();
    const scopedUserId = userId ? Number(userId) : null;

    if (phone) {
      const params = channel ? [phone, channel] : [phone];
      let query = channel
        ? 'SELECT * FROM leads WHERE phone = ? AND channel = ?'
        : 'SELECT * FROM leads WHERE phone = ?';
      if (scopedUserId) {
        query += ' AND userId = ?';
        params.push(scopedUserId);
      }
      query += ' ORDER BY id DESC LIMIT 1';

      const byPhone = await db.get(
        query,
        params
      );
      if (byPhone) return this.parseRow(byPhone);
    }

    if (email) {
      const params = channel ? [email, channel] : [email];
      let query = channel
        ? 'SELECT * FROM leads WHERE email = ? AND channel = ?'
        : 'SELECT * FROM leads WHERE email = ?';
      if (scopedUserId) {
        query += ' AND userId = ?';
        params.push(scopedUserId);
      }
      query += ' ORDER BY id DESC LIMIT 1';

      const byEmail = await db.get(
        query,
        params
      );
      return this.parseRow(byEmail);
    }

    return null;
  }

  static async allWithLastMessage(userId = null) {
    const db = await getDb();
    const params = [];
    const where = userId ? 'WHERE l.userId = ?' : '';
    if (userId) params.push(userId);

    const rows = await db.all(
      `SELECT
         l.*,
         m.content AS lastMessage,
         m.timestamp AS lastMessageAt,
         m.deliveryStatus AS lastMessageDeliveryStatus,
         m.draftState AS lastMessageDraftState,
         m.confidence AS lastMessageConfidence,
         m.riskFlags AS lastMessageRiskFlags,
         m.orchestratorDecision AS lastMessageOrchestratorDecision,
         m.intelligenceSnapshot AS lastMessageIntelligenceSnapshot
       FROM leads l
       LEFT JOIN messages m ON m.id = (
         SELECT id FROM messages WHERE leadId = l.id ORDER BY timestamp DESC, id DESC LIMIT 1
       )
       ${where}
       ORDER BY COALESCE(m.timestamp, l.createdAt) DESC`,
      params
    );

    return rows.map((row) => this.parseRow(row)).map((row) => ({
      ...row,
      lastMessageRiskFlags: this.parseJson(row.lastMessageRiskFlags, []),
      lastMessageOrchestratorDecision: this.parseJson(row.lastMessageOrchestratorDecision, null),
      lastMessageIntelligenceSnapshot: this.parseJson(row.lastMessageIntelligenceSnapshot, null),
    }));
  }

  static async update(id, updates) {
    const db = await getDb();
    const current = await this.getById(id);
    if (!current) return null;

    const next = {
      userId: updates.userId ?? current.userId,
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
      intent: updates.intent ?? current.intent,
      urgency: updates.urgency ?? current.urgency,
      stageHistory: updates.stageHistory ?? current.stageHistory,
      responseSlaMinutes: updates.responseSlaMinutes ?? current.responseSlaMinutes,
      intelligenceSnapshot: updates.intelligenceSnapshot ?? current.intelligenceSnapshot,
      aiPaused: updates.aiPaused ?? current.aiPaused,
    };

    await db.run(
      `UPDATE leads
       SET userId = ?, name = ?, phone = ?, email = ?, sessionId = ?, channel = ?, status = ?, budget = ?, timeline = ?, location = ?, propertyType = ?, sentiment = ?, intent = ?, urgency = ?, stageHistory = ?, responseSlaMinutes = ?, intelligenceSnapshot = ?, aiPaused = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        next.userId,
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
        next.intent,
        next.urgency,
        next.stageHistory ? JSON.stringify(next.stageHistory) : null,
        next.responseSlaMinutes,
        next.intelligenceSnapshot ? JSON.stringify(next.intelligenceSnapshot) : null,
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
