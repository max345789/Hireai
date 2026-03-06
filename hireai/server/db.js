const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

let db;

async function getDb() {
  if (db) {
    return db;
  }

  db = await open({
    filename: path.join(__dirname, 'data', 'hireai.db'),
    driver: sqlite3.Database,
  });

  await db.exec('PRAGMA foreign_keys = ON');
  return db;
}

async function ensureColumn(database, table, column, definition) {
  const columns = await database.all(`PRAGMA table_info(${table})`);
  const exists = columns.some((item) => item.name === column);
  if (!exists) {
    await database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function initDb() {
  const database = await getDb();

  await database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agencyName TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      twilioKey TEXT,
      gmailConfig TEXT,
      agentPersonality TEXT,
      logoUrl TEXT,
      calendarConfig TEXT,
      listingsData TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      sessionId TEXT,
      channel TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      budget TEXT,
      timeline TEXT,
      location TEXT,
      propertyType TEXT,
      sentiment TEXT,
      aiPaused INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      leadId INTEGER NOT NULL,
      direction TEXT NOT NULL,
      channel TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      sentByAI INTEGER DEFAULT 0,
      externalSid TEXT,
      deliveryStatus TEXT DEFAULT 'sent',
      error TEXT,
      metadata TEXT,
      FOREIGN KEY (leadId) REFERENCES leads (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      leadId INTEGER NOT NULL,
      dateTime TEXT NOT NULL,
      property TEXT,
      status TEXT DEFAULT 'scheduled',
      notes TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (leadId) REFERENCES leads (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      leadId INTEGER,
      leadName TEXT,
      action TEXT,
      channel TEXT,
      description TEXT,
      sentByAI INTEGER DEFAULT 0,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (leadId) REFERENCES leads (id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS blocked_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE,
      reason TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS webhook_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel TEXT NOT NULL,
      eventType TEXT,
      payload TEXT,
      status TEXT DEFAULT 'received',
      error TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS widget_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId TEXT UNIQUE NOT NULL,
      leadId INTEGER,
      agencyId TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      lastSeenAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (leadId) REFERENCES leads (id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS followup_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      leadId INTEGER NOT NULL,
      leadName TEXT,
      sequenceStep INTEGER DEFAULT 1,
      channel TEXT,
      message TEXT,
      sentAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (leadId) REFERENCES leads (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      stripeCustomerId TEXT,
      stripeSubscriptionId TEXT,
      plan TEXT DEFAULT 'starter',
      status TEXT DEFAULT 'trialing',
      currentPeriodEnd TEXT,
      cancelAtPeriodEnd INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_lead_timestamp ON messages (leadId, timestamp DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_channel_timestamp ON messages (channel, timestamp DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_activity_log_timestamp ON activity_log (timestamp DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_blocked_phone ON blocked_contacts (phone);
    CREATE INDEX IF NOT EXISTS idx_widget_sessions_session ON widget_sessions (sessionId);

    CREATE TRIGGER IF NOT EXISTS leads_updated_at
    AFTER UPDATE ON leads
    BEGIN
      UPDATE leads SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
  `);

  await ensureColumn(database, 'leads', 'propertyType', 'TEXT');
  await ensureColumn(database, 'leads', 'sentiment', 'TEXT');
  await ensureColumn(database, 'leads', 'sessionId', 'TEXT');

  await ensureColumn(database, 'messages', 'externalSid', 'TEXT');
  await ensureColumn(database, 'messages', 'deliveryStatus', "TEXT DEFAULT 'sent'");
  await ensureColumn(database, 'messages', 'error', 'TEXT');
  await ensureColumn(database, 'messages', 'metadata', 'TEXT');

  await ensureColumn(database, 'bookings', 'calendarEventId', 'TEXT');
  await ensureColumn(database, 'bookings', 'confirmedAt', 'TEXT');
  await ensureColumn(database, 'bookings', 'cancelledAt', 'TEXT');
  await ensureColumn(database, 'bookings', 'reminderSent', 'INTEGER DEFAULT 0');
  await ensureColumn(database, 'bookings', 'address', 'TEXT');
  await ensureColumn(database, 'bookings', 'clientEmail', 'TEXT');
  await ensureColumn(database, 'bookings', 'clientPhone', 'TEXT');

  await ensureColumn(database, 'leads', 'followupCount', 'INTEGER DEFAULT 0');
  await ensureColumn(database, 'leads', 'lastFollowupAt', 'TEXT');
  await ensureColumn(database, 'leads', 'followupPaused', 'INTEGER DEFAULT 0');

  await ensureColumn(database, 'users', 'stripeCustomerId', 'TEXT');
  await ensureColumn(database, 'users', 'plan', "TEXT DEFAULT 'trial'");
  await ensureColumn(database, 'users', 'planStatus', "TEXT DEFAULT 'active'");
  await ensureColumn(database, 'users', 'planExpiresAt', 'TEXT');
  await ensureColumn(database, 'users', 'onboardingComplete', 'INTEGER DEFAULT 0');
  await ensureColumn(database, 'users', 'greetingMessage', 'TEXT');
  await ensureColumn(database, 'users', 'widgetColor', "TEXT DEFAULT '#6C63FF'");
}

module.exports = {
  getDb,
  initDb,
};
