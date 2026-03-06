const { getDb } = require('../db');

class User {
  static async create(data) {
    const db = await getDb();
    const result = await db.run(
      `INSERT INTO users (agencyName, email, password, twilioKey, gmailConfig, agentPersonality, logoUrl, calendarConfig, listingsData)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.agencyName,
        data.email,
        data.password,
        data.twilioKey || null,
        data.gmailConfig || null,
        data.agentPersonality || null,
        data.logoUrl || null,
        data.calendarConfig || null,
        data.listingsData || null,
      ]
    );

    return this.getById(result.lastID);
  }

  static async getById(id) {
    const db = await getDb();
    return db.get('SELECT * FROM users WHERE id = ?', [id]);
  }

  static async findByEmail(email) {
    const db = await getDb();
    return db.get('SELECT * FROM users WHERE email = ?', [email]);
  }

  static async firstUser() {
    const db = await getDb();
    return db.get('SELECT * FROM users ORDER BY id ASC LIMIT 1');
  }

  static async updateSettings(id, updates) {
    const db = await getDb();
    const current = await this.getById(id);
    if (!current) return null;

    const next = {
      agencyName: updates.agencyName ?? current.agencyName,
      twilioKey: updates.twilioKey ?? current.twilioKey,
      gmailConfig: updates.gmailConfig ?? current.gmailConfig,
      agentPersonality: updates.agentPersonality ?? current.agentPersonality,
      logoUrl: updates.logoUrl ?? current.logoUrl,
      calendarConfig: updates.calendarConfig ?? current.calendarConfig,
      listingsData: updates.listingsData ?? current.listingsData,
    };

    await db.run(
      `UPDATE users
       SET agencyName = ?, twilioKey = ?, gmailConfig = ?, agentPersonality = ?, logoUrl = ?, calendarConfig = ?, listingsData = ?
       WHERE id = ?`,
      [
        next.agencyName,
        next.twilioKey,
        next.gmailConfig,
        next.agentPersonality,
        next.logoUrl,
        next.calendarConfig,
        next.listingsData,
        id,
      ]
    );

    return this.getById(id);
  }
}

module.exports = User;
