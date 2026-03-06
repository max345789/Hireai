const { getDb } = require('../db');
const { env } = require('../config/env');
const { sanitizeObject } = require('../services/logger');

function preparePayload(payload) {
  if (!payload) return null;

  const value = env.sanitizeWebhookPayloads ? sanitizeObject(payload) : payload;
  const serialized = JSON.stringify(value);

  if (serialized.length <= env.webhookPayloadMaxChars) {
    return serialized;
  }

  return `${serialized.slice(0, env.webhookPayloadMaxChars)}...[truncated]`;
}

class WebhookEvent {
  static async create({ channel, eventType, payload, status = 'received', error = null }) {
    const db = await getDb();
    const result = await db.run(
      `INSERT INTO webhook_events (channel, eventType, payload, status, error)
       VALUES (?, ?, ?, ?, ?)`,
      [
        channel,
        eventType || null,
        preparePayload(payload),
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
