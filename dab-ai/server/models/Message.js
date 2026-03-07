const { getDb } = require('../db');

class Message {
  static parseJson(value, fallback) {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  static parseRow(row) {
    if (!row) return row;

    return {
      ...row,
      metadata: this.parseJson(row.metadata, null),
      riskFlags: this.parseJson(row.riskFlags, []),
      orchestratorDecision: this.parseJson(row.orchestratorDecision, null),
      intelligenceSnapshot: this.parseJson(row.intelligenceSnapshot, null),
    };
  }

  static async create(data) {
    const db = await getDb();
    const result = await db.run(
      `INSERT INTO messages (leadId, direction, channel, content, sentByAI, draftState, confidence, riskFlags, orchestratorDecision, intelligenceSnapshot, externalSid, deliveryStatus, error, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.leadId,
        data.direction,
        data.channel,
        data.content,
        data.sentByAI ? 1 : 0,
        data.draftState || 'sent',
        data.confidence ?? null,
        data.riskFlags ? JSON.stringify(data.riskFlags) : null,
        data.orchestratorDecision ? JSON.stringify(data.orchestratorDecision) : null,
        data.intelligenceSnapshot ? JSON.stringify(data.intelligenceSnapshot) : null,
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
    const row = await db.get('SELECT * FROM messages WHERE id = ?', [id]);
    return this.parseRow(row);
  }

  static async updateDelivery(id, { externalSid, deliveryStatus, error, draftState }) {
    const db = await getDb();
    const current = await this.getById(id);
    if (!current) return null;

    const nextExternalSid = externalSid === undefined ? current.externalSid : externalSid;
    const nextStatus = deliveryStatus === undefined ? current.deliveryStatus : deliveryStatus;
    const nextError = error === undefined ? current.error : error;
    const nextDraftState = draftState === undefined ? current.draftState : draftState;

    await db.run(
      `UPDATE messages
       SET externalSid = ?, deliveryStatus = ?, error = ?, draftState = ?
       WHERE id = ?`,
      [nextExternalSid, nextStatus, nextError, nextDraftState, id]
    );
    return this.getById(id);
  }

  static async updateDraft(id, { content, confidence, riskFlags, orchestratorDecision, intelligenceSnapshot, metadata, draftState }) {
    const db = await getDb();
    const current = await this.getById(id);
    if (!current) return null;

    const next = {
      content: content ?? current.content,
      confidence: confidence ?? current.confidence,
      riskFlags: riskFlags ?? current.riskFlags,
      orchestratorDecision: orchestratorDecision ?? current.orchestratorDecision,
      intelligenceSnapshot: intelligenceSnapshot ?? current.intelligenceSnapshot,
      metadata: metadata ?? current.metadata,
      draftState: draftState ?? current.draftState,
    };

    await db.run(
      `UPDATE messages
       SET content = ?, confidence = ?, riskFlags = ?, orchestratorDecision = ?, intelligenceSnapshot = ?, metadata = ?, draftState = ?
       WHERE id = ?`,
      [
        next.content,
        next.confidence,
        next.riskFlags ? JSON.stringify(next.riskFlags) : null,
        next.orchestratorDecision ? JSON.stringify(next.orchestratorDecision) : null,
        next.intelligenceSnapshot ? JSON.stringify(next.intelligenceSnapshot) : null,
        next.metadata ? JSON.stringify(next.metadata) : null,
        next.draftState,
        id,
      ]
    );

    return this.getById(id);
  }

  static async getByLeadId(leadId, options = {}) {
    const db = await getDb();
    const sinceId = Number(options.sinceId || 0);

    let rows;
    if (sinceId > 0) {
      rows = await db.all(
        'SELECT * FROM messages WHERE leadId = ? AND id > ? ORDER BY timestamp ASC, id ASC',
        [leadId, sinceId]
      );
    } else {
      rows = await db.all(
        'SELECT * FROM messages WHERE leadId = ? ORDER BY timestamp ASC, id ASC',
        [leadId]
      );
    }

    return rows.map((row) => this.parseRow(row));
  }

  static async getLatestInboundByLead(leadId) {
    const db = await getDb();
    const row = await db.get(
      `SELECT * FROM messages
       WHERE leadId = ? AND direction = 'in'
       ORDER BY timestamp DESC, id DESC LIMIT 1`,
      [leadId]
    );
    return this.parseRow(row);
  }

  static async recentFeed(limit = 80, userId = null) {
    const db = await getDb();
    const params = [];
    const where = userId ? 'WHERE l.userId = ?' : '';
    if (userId) params.push(userId);
    params.push(limit);

    const rows = await db.all(
      `SELECT
         m.*,
         l.name AS leadName,
         l.status AS leadStatus,
         l.aiPaused AS leadAiPaused,
         l.sentiment AS leadSentiment,
         l.intent AS leadIntent,
         l.urgency AS leadUrgency,
         l.userId AS leadUserId
       FROM messages m
       JOIN leads l ON l.id = m.leadId
       ${where}
       ORDER BY m.timestamp DESC, m.id DESC
       LIMIT ?`,
      params
    );

    return rows.map((row) => this.parseRow(row));
  }

  static async listThreads({ userId = null, limit = 120 } = {}) {
    const db = await getDb();
    const params = [];
    const where = userId ? 'WHERE l.userId = ?' : '';
    if (userId) params.push(userId);
    params.push(limit);

    const rows = await db.all(
      `SELECT
         l.id AS threadId,
         l.userId,
         l.name AS leadName,
         l.status AS leadStatus,
         l.channel AS leadChannel,
         l.sentiment,
         l.intent,
         l.urgency,
         l.budget,
         l.timeline,
         l.location,
         l.propertyType,
         l.intelligenceSnapshot,
         m.id AS messageId,
         m.direction,
         m.channel,
         m.content,
         m.timestamp,
         m.sentByAI,
         m.draftState,
         m.confidence,
         m.riskFlags,
         m.orchestratorDecision,
         m.intelligenceSnapshot AS messageIntelligenceSnapshot,
         m.deliveryStatus
       FROM leads l
       LEFT JOIN messages m ON m.id = (
         SELECT id FROM messages WHERE leadId = l.id ORDER BY timestamp DESC, id DESC LIMIT 1
       )
       ${where}
       ORDER BY COALESCE(m.timestamp, l.updatedAt) DESC
       LIMIT ?`,
      params
    );

    return rows.map((row) => ({
      ...row,
      riskFlags: this.parseJson(row.riskFlags, []),
      orchestratorDecision: this.parseJson(row.orchestratorDecision, null),
      intelligenceSnapshot: this.parseJson(row.intelligenceSnapshot, null),
      messageIntelligenceSnapshot: this.parseJson(row.messageIntelligenceSnapshot, null),
    }));
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

  static async todayChannelCounts(userId = null) {
    const db = await getDb();
    const params = [];
    const where = userId ? 'WHERE l.userId = ?' : '';
    if (userId) params.push(userId);

    const rows = await db.all(
      `SELECT m.channel, m.direction, m.sentByAI, m.timestamp
       FROM messages m
       JOIN leads l ON l.id = m.leadId
       ${where}
       ORDER BY m.timestamp DESC LIMIT 8000`,
      params
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
}

module.exports = Message;
