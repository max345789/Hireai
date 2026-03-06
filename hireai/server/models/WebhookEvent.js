const { getDb } = require('../db');

class WebhookEvent {
  static async create({ channel, eventType, payload, status = 'received', error = null }) {
    const db = await getDb();
    const result = await db.run(
      `INSERT INTO webhook_events (channel, eventType, payload, status, error)
       VALUES (?, ?, ?, ?, ?)`,
      [
        channel,
        eventType || null,
        payload ? JSON.stringify(payload) : null,
        status,
        error,
      ]
    );

    return this.getById(result.lastID);
  }

  static async getById(id) {
    const db = await getDb();
    return db.get('SELECT * FROM webhook_events WHERE id = ?', [id]);
  }

  static async markProcessed(id) {
    const db = await getDb();
    await db.run(`UPDATE webhook_events SET status = 'processed', error = NULL WHERE id = ?`, [id]);
  }

  static async markFailed(id, error) {
    const db = await getDb();
    await db.run(`UPDATE webhook_events SET status = 'failed', error = ? WHERE id = ?`, [error, id]);
  }
}

module.exports = WebhookEvent;
