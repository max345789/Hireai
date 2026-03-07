const { getDb, isPostgres } = require('../db');

class IdempotencyKey {
  static async get(scope, key) {
    const db = await getDb();
    return db.get(
      `SELECT * FROM idempotency_keys
       WHERE scope = ? AND key = ?
       ORDER BY id DESC LIMIT 1`,
      [scope, key]
    );
  }

  static async reserve(scope, key, requestHash, ttlHours = 24) {
    const db = await getDb();
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();

    try {
      const result = await db.run(
        `INSERT INTO idempotency_keys (scope, key, requestHash, status, expiresAt)
         VALUES (?, ?, ?, 'processing', ?)`,
        [scope, key, requestHash, expiresAt]
      );

      return {
        created: true,
        row: await this.getById(result.lastID),
      };
    } catch (error) {
      if (String(error.message).includes('UNIQUE')) {
        return {
          created: false,
          row: await this.get(scope, key),
        };
      }
      throw error;
    }
  }

  static async getById(id) {
    const db = await getDb();
    return db.get('SELECT * FROM idempotency_keys WHERE id = ?', [id]);
  }

  static async complete(id, statusCode, responseBody) {
    const db = await getDb();
    await db.run(
      `UPDATE idempotency_keys
       SET status = 'completed', statusCode = ?, responseBody = ?
       WHERE id = ?`,
      [statusCode || 200, responseBody || null, id]
    );

    return this.getById(id);
  }

  static async fail(id, statusCode, responseBody) {
    const db = await getDb();
    await db.run(
      `UPDATE idempotency_keys
       SET status = 'failed', statusCode = ?, responseBody = ?
       WHERE id = ?`,
      [statusCode || 500, responseBody || null, id]
    );

    return this.getById(id);
  }

  static async markProcessing(id) {
    const db = await getDb();
    await db.run(
      `UPDATE idempotency_keys
       SET status = 'processing', statusCode = NULL, responseBody = NULL
       WHERE id = ?`,
      [id]
    );
    return this.getById(id);
  }

  static async deleteExpired() {
    const db = await getDb();
    const result = await db.run(
      `DELETE FROM idempotency_keys
       WHERE expiresAt IS NOT NULL
         AND ${isPostgres() ? 'expiresAt <= CURRENT_TIMESTAMP' : "datetime(expiresAt) <= datetime('now')"}`
    );

    return Number(result?.changes || 0);
  }
}

module.exports = IdempotencyKey;
