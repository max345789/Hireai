const { getDb } = require('../db');

class Booking {
  static async create(data) {
    const db = await getDb();
    const result = await db.run(
      `INSERT INTO bookings (leadId, dateTime, property, status, notes, address, clientEmail, clientPhone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.leadId,
        data.dateTime,
        data.property || 'Property Viewing',
        data.status || 'scheduled',
        data.notes || null,
        data.address || null,
        data.clientEmail || null,
        data.clientPhone || null,
      ]
    );

    return this.getById(result.lastID);
  }

  static async getById(id) {
    const db = await getDb();
    return db.get(
      `SELECT b.*, l.name AS leadName, l.channel AS leadChannel, l.email AS leadEmail, l.phone AS leadPhone
       FROM bookings b
       JOIN leads l ON l.id = b.leadId
       WHERE b.id = ?`,
      [id]
    );
  }

  static async all() {
    const db = await getDb();
    return db.all(
      `SELECT
         b.*,
         l.name AS leadName,
         l.channel AS leadChannel
       FROM bookings b
       JOIN leads l ON l.id = b.leadId
       ORDER BY b.dateTime ASC`
    );
  }

  static async today() {
    const db = await getDb();
    return db.all(
      `SELECT
         b.*,
         l.name AS leadName,
         l.channel AS leadChannel
       FROM bookings b
       JOIN leads l ON l.id = b.leadId
       WHERE date(b.dateTime) = date('now', 'localtime')
       ORDER BY b.dateTime ASC`
    );
  }

  static async upcoming(days = 7) {
    const db = await getDb();
    return db.all(
      `SELECT b.*, l.name AS leadName, l.channel AS leadChannel
       FROM bookings b
       JOIN leads l ON l.id = b.leadId
       WHERE b.dateTime >= datetime('now')
         AND b.dateTime <= datetime('now', '+${days} days')
         AND b.status NOT IN ('cancelled', 'completed')
       ORDER BY b.dateTime ASC`
    );
  }

  static async update(id, updates) {
    const db = await getDb();
    const current = await this.getById(id);
    if (!current) return null;

    const fields = [];
    const values = [];

    const allowed = ['dateTime', 'property', 'status', 'notes', 'calendarEventId', 'confirmedAt', 'cancelledAt', 'reminderSent', 'address', 'clientEmail', 'clientPhone'];

    for (const key of allowed) {
      if (key in updates) {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    }

    if (fields.length === 0) return current;

    values.push(id);
    await db.run(`UPDATE bookings SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.getById(id);
  }

  static async cancel(id) {
    return this.update(id, { status: 'cancelled', cancelledAt: new Date().toISOString() });
  }

  static async confirm(id) {
    return this.update(id, { status: 'confirmed', confirmedAt: new Date().toISOString() });
  }

  static async stats(fromDate, toDate) {
    const db = await getDb();
    const from = fromDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const to = toDate || new Date().toISOString();

    return db.get(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) AS scheduled,
         SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
         SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled
       FROM bookings
       WHERE createdAt BETWEEN ? AND ?`,
      [from, to]
    );
  }
}

module.exports = Booking;
