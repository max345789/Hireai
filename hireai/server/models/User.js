const crypto = require('crypto');
const { getDb } = require('../db');

class User {
  static generateWidgetCredentials() {
    return {
      widgetId: `wid_${crypto.randomBytes(12).toString('hex')}`,
      widgetSecret: `whsec_${crypto.randomBytes(20).toString('hex')}`,
    };
  }

  static async create(data) {
    const db = await getDb();
    const { widgetId, widgetSecret } = this.generateWidgetCredentials();
    const result = await db.run(
      `INSERT INTO users (agencyName, email, password, twilioKey, gmailConfig, metaConfig, agentPersonality, logoUrl, calendarConfig, listingsData, widgetId, widgetSecret)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.agencyName,
        data.email,
        data.password,
        data.twilioKey || null,
        data.gmailConfig || null,
        data.metaConfig || null,
        data.agentPersonality || null,
        data.logoUrl || null,
        data.calendarConfig || null,
        data.listingsData || null,
        widgetId,
        widgetSecret,
      ]
    );

    return this.getById(result.lastID);
  }

  static async findByWidgetId(widgetId) {
    if (!widgetId) return null;
    const db = await getDb();
    return db.get('SELECT * FROM users WHERE widgetId = ?', [widgetId]);
  }

  static async getById(id) {
    const db = await getDb();
    return db.get('SELECT * FROM users WHERE id = ?', [id]);
  }

  static async findByEmail(email) {
    const db = await getDb();
    return db.get('SELECT * FROM users WHERE email = ?', [email]);
  }

  static async findByAgencyName(agencyName) {
    const db = await getDb();
    return db.get('SELECT * FROM users WHERE agencyName = ? LIMIT 1', [agencyName]);
  }

  static async all() {
    const db = await getDb();
    return db.all('SELECT * FROM users ORDER BY id ASC');
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
      metaConfig: updates.metaConfig ?? current.metaConfig,
      agentPersonality: updates.agentPersonality ?? current.agentPersonality,
      logoUrl: updates.logoUrl ?? current.logoUrl,
      calendarConfig: updates.calendarConfig ?? current.calendarConfig,
      listingsData: updates.listingsData ?? current.listingsData,
      plan: updates.plan ?? current.plan,
      planStatus: updates.planStatus ?? current.planStatus,
      planExpiresAt: updates.planExpiresAt ?? current.planExpiresAt,
      onboardingComplete: updates.onboardingComplete ?? current.onboardingComplete,
      greetingMessage: updates.greetingMessage ?? current.greetingMessage,
      widgetColor: updates.widgetColor ?? current.widgetColor,
      stripeCustomerId: updates.stripeCustomerId ?? current.stripeCustomerId,
    };

    await db.run(
      `UPDATE users
       SET agencyName = ?, twilioKey = ?, gmailConfig = ?, metaConfig = ?,
           agentPersonality = ?, logoUrl = ?, calendarConfig = ?, listingsData = ?,
           plan = ?, planStatus = ?, planExpiresAt = ?, onboardingComplete = ?,
           greetingMessage = ?, widgetColor = ?, stripeCustomerId = ?
       WHERE id = ?`,
      [
        next.agencyName,
        next.twilioKey,
        next.gmailConfig,
        next.metaConfig,
        next.agentPersonality,
        next.logoUrl,
        next.calendarConfig,
        next.listingsData,
        next.plan,
        next.planStatus,
        next.planExpiresAt,
        next.onboardingComplete,
        next.greetingMessage,
        next.widgetColor,
        next.stripeCustomerId,
        id,
      ]
    );

    return this.getById(id);
  }
}

module.exports = User;
