const crypto = require('crypto');
const { getDb, isPostgres } = require('../db');

class WidgetSession {
  static makeSessionId() {
    return `sid_${crypto.randomBytes(12).toString('hex')}`;
  }

  static makeAccessToken() {
    return `ws_${crypto.randomBytes(18).toString('hex')}`;
  }

  static async create({ leadId, agencyId }) {
    const db = await getDb();
    const sessionId = this.makeSessionId();
    const accessToken = this.makeAccessToken();

    const result = await db.run(
      `INSERT INTO widget_sessions (sessionId, leadId, agencyId, accessToken)
       VALUES (?, ?, ?, ?)`,
      [sessionId, leadId || null, agencyId || null, accessToken]
    );

    return this.getById(result.lastID);
  }

  static async getById(id) {
    const db = await getDb();
    return db.get('SELECT * FROM widget_sessions WHERE id = ?', [id]);
  }

  static async findBySessionId(sessionId) {
    const db = await getDb();
    return db.get('SELECT * FROM widget_sessions WHERE sessionId = ?', [sessionId]);
  }

  static async touch(sessionId) {
    const db = await getDb();
    await db.run('UPDATE widget_sessions SET lastSeenAt = CURRENT_TIMESTAMP WHERE sessionId = ?', [sessionId]);
  }

  static async countActive() {
    const db = await getDb();
    const row = await db.get(
      `SELECT COUNT(*) AS count
       FROM widget_sessions
       WHERE ${isPostgres() ? "lastSeenAt >= CURRENT_TIMESTAMP - INTERVAL '1 day'" : "datetime(lastSeenAt) >= datetime('now', '-1 day')"}`
    );

    return Number(row?.count || 0);
  }

  static async totalCount() {
    const db = await getDb();
    const row = await db.get('SELECT COUNT(*) AS count FROM widget_sessions');
    return Number(row?.count || 0);
  }
}

module.exports = WidgetSession;
