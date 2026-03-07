const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

let db;

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || null;

const CAMEL_KEYS = [
  'agencyName',
  'agentPersonality',
  'aiPaused',
  'avgMinutes',
  'archived',
  'calendarConfig',
  'calendarEventId',
  'cancelAtPeriodEnd',
  'cancelledAt',
  'clientEmail',
  'clientPhone',
  'createdAt',
  'currentPeriodEnd',
  'dateTime',
  'deliveryStatus',
  'draftState',
  'eventType',
  'expiresAt',
  'externalSid',
  'followupCount',
  'followupPaused',
  'greetingMessage',
  'gmailConfig',
  'id',
  'intelligenceSnapshot',
  'lastFollowupAt',
  'lastMessage',
  'lastMessageAt',
  'lastMessageConfidence',
  'lastMessageDeliveryStatus',
  'lastMessageDraftState',
  'lastMessageIntelligenceSnapshot',
  'lastMessageOrchestratorDecision',
  'lastMessageRiskFlags',
  'lastSeenAt',
  'leadAiPaused',
  'leadChannel',
  'leadEmail',
  'leadId',
  'leadIntent',
  'leadName',
  'leadPhone',
  'leadScore',
  'leadSentiment',
  'leadStatus',
  'leadUserId',
  'listingsData',
  'logoUrl',
  'messageId',
  'messageIntelligenceSnapshot',
  'metaConfig',
  'notificationPrefs',
  'onboardingComplete',
  'orchestratorDecision',
  'planExpiresAt',
  'planStatus',
  'propertyType',
  'reminderSent',
  'requestHash',
  'responseBody',
  'responseSlaMinutes',
  'selectedAgent',
  'sentAt',
  'sentByAI',
  'sequenceStep',
  'sessionId',
  'slackWebhook',
  'stageHistory',
  'statusCode',
  'stripeCustomerId',
  'stripeSubscriptionId',
  'threadId',
  'twilioKey',
  'updatedAt',
  'userId',
  'uniqueLeads',
  'widgetColor',
  'widgetId',
  'widgetSecret',
];

const KEY_MAP = new Map(CAMEL_KEYS.map((key) => [key.toLowerCase(), key]));

function normalizeRowKeys(row) {
  if (!row || Array.isArray(row) || typeof row !== 'object') return row;

  const normalized = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[KEY_MAP.get(key) || key] = value;
  }
  return normalized;
}

function normalizeRows(rows) {
  return Array.isArray(rows) ? rows.map(normalizeRowKeys) : [];
}

function isPostgres() {
  return Boolean(DATABASE_URL);
}

function resolveCandidate(input) {
  if (!input) return null;
  if (path.isAbsolute(input)) return input;
  return path.resolve(process.cwd(), input);
}

function dbCandidates() {
  const values = [
    resolveCandidate(process.env.DB_PATH),
    path.resolve(__dirname, 'data', 'dab-ai.db'),
    '/tmp/dab-ai.db',
  ].filter(Boolean);

  const unique = [];
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    unique.push(value);
  }

  return unique;
}

function toPgPlaceholders(sql) {
  let index = 0;
  return String(sql).replace(/\?/g, () => `$${++index}`);
}

function withReturningId(sql) {
  if (!/^\s*insert\s+/i.test(sql) || /\breturning\b/i.test(sql)) {
    return sql;
  }
  return `${sql.trim()} RETURNING id`;
}

function normalizePgError(error) {
  if (error?.code === '23505') {
    error.message = `SQLITE_CONSTRAINT: UNIQUE constraint failed: ${error.constraint || 'unique'}`;
  }
  return error;
}

async function createPostgresDb() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });

  return {
    dialect: 'postgres',
    async get(sql, params = []) {
      const result = await pool.query(toPgPlaceholders(sql), params);
      return normalizeRowKeys(result.rows[0] || null);
    },
    async all(sql, params = []) {
      const result = await pool.query(toPgPlaceholders(sql), params);
      return normalizeRows(result.rows);
    },
    async run(sql, params = []) {
      try {
        const text = withReturningId(toPgPlaceholders(sql));
        const result = await pool.query(text, params);
        const firstRow = normalizeRowKeys(result.rows[0] || null);
        return {
          lastID: firstRow?.id ?? null,
          changes: Number(result.rowCount || 0),
        };
      } catch (error) {
        throw normalizePgError(error);
      }
    },
    async exec(sql) {
      await pool.query(String(sql));
    },
    async close() {
      await pool.end();
    },
  };
}

async function createSqliteDb() {
  const attempts = [];

  for (const filename of dbCandidates()) {
    try {
      fs.mkdirSync(path.dirname(filename), { recursive: true });

      const opened = await open({
        filename,
        driver: sqlite3.Database,
      });

      await opened.exec('PRAGMA foreign_keys = ON');
      opened.dialect = 'sqlite';
      return opened;
    } catch (error) {
      attempts.push(`${filename}: ${error.message}`);
    }
  }

  throw new Error(`SQLITE_CANTOPEN: unable to open database file. Tried -> ${attempts.join(' | ')}`);
}

async function getDb() {
  if (db) {
    return db;
  }

  db = isPostgres() ? await createPostgresDb() : await createSqliteDb();
  return db;
}

async function ensureColumnSqlite(database, table, column, definition) {
  const columns = await database.all(`PRAGMA table_info(${table})`);
  const exists = columns.some((item) => item.name === column);
  if (!exists) {
    await database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function ensureColumnPostgres(database, table, column, definition) {
  await database.exec(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column.toLowerCase()} ${definition}`);
}

async function initSqliteDb(database) {
  await database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agencyName TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      twilioKey TEXT,
      gmailConfig TEXT,
      metaConfig TEXT,
      agentPersonality TEXT,
      logoUrl TEXT,
      calendarConfig TEXT,
      listingsData TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
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
      intent TEXT,
      urgency TEXT,
      stageHistory TEXT,
      responseSlaMinutes INTEGER,
      intelligenceSnapshot TEXT,
      aiPaused INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users (id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      leadId INTEGER NOT NULL,
      direction TEXT NOT NULL,
      channel TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      sentByAI INTEGER DEFAULT 0,
      draftState TEXT DEFAULT 'sent',
      confidence REAL,
      riskFlags TEXT,
      orchestratorDecision TEXT,
      intelligenceSnapshot TEXT,
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
      userId INTEGER,
      leadName TEXT,
      action TEXT,
      channel TEXT,
      description TEXT,
      sentByAI INTEGER DEFAULT 0,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (leadId) REFERENCES leads (id) ON DELETE SET NULL,
      FOREIGN KEY (userId) REFERENCES users (id) ON DELETE SET NULL
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

    CREATE TABLE IF NOT EXISTS idempotency_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scope TEXT NOT NULL,
      key TEXT NOT NULL,
      requestHash TEXT NOT NULL,
      status TEXT DEFAULT 'processing',
      statusCode INTEGER,
      responseBody TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      expiresAt TEXT,
      UNIQUE(scope, key)
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
    CREATE INDEX IF NOT EXISTS idx_idempotency_scope_key ON idempotency_keys (scope, key);
    CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys (expiresAt);

    CREATE TRIGGER IF NOT EXISTS leads_updated_at
    AFTER UPDATE ON leads
    BEGIN
      UPDATE leads SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
  `);

  const ensureColumn = ensureColumnSqlite;

  await ensureColumn(database, 'leads', 'propertyType', 'TEXT');
  await ensureColumn(database, 'leads', 'sentiment', 'TEXT');
  await ensureColumn(database, 'leads', 'sessionId', 'TEXT');
  await ensureColumn(database, 'leads', 'userId', 'INTEGER');
  await ensureColumn(database, 'leads', 'intent', 'TEXT');
  await ensureColumn(database, 'leads', 'urgency', 'TEXT');
  await ensureColumn(database, 'leads', 'stageHistory', 'TEXT');
  await ensureColumn(database, 'leads', 'responseSlaMinutes', 'INTEGER');
  await ensureColumn(database, 'leads', 'intelligenceSnapshot', 'TEXT');

  await ensureColumn(database, 'messages', 'externalSid', 'TEXT');
  await ensureColumn(database, 'messages', 'deliveryStatus', "TEXT DEFAULT 'sent'");
  await ensureColumn(database, 'messages', 'error', 'TEXT');
  await ensureColumn(database, 'messages', 'metadata', 'TEXT');
  await ensureColumn(database, 'messages', 'draftState', "TEXT DEFAULT 'sent'");
  await ensureColumn(database, 'messages', 'confidence', 'REAL');
  await ensureColumn(database, 'messages', 'riskFlags', 'TEXT');
  await ensureColumn(database, 'messages', 'orchestratorDecision', 'TEXT');
  await ensureColumn(database, 'messages', 'intelligenceSnapshot', 'TEXT');

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
  await ensureColumn(database, 'users', 'metaConfig', 'TEXT');
  await ensureColumn(database, 'activity_log', 'userId', 'INTEGER');
  await ensureColumn(database, 'users', 'selectedAgent', "TEXT DEFAULT 'salesbot'");
  await ensureColumn(database, 'users', 'role', "TEXT DEFAULT 'admin'");
  await ensureColumn(database, 'users', 'accentColor', "TEXT DEFAULT '#f97316'");
  await ensureColumn(database, 'users', 'slackWebhook', 'TEXT');
  await ensureColumn(database, 'users', 'notificationPrefs', "TEXT DEFAULT '{}'");
  await ensureColumn(database, 'leads', 'leadScore', 'INTEGER DEFAULT 0');
  await ensureColumn(database, 'leads', 'archived', 'INTEGER DEFAULT 0');
  await ensureColumn(database, 'users', 'widgetId', 'TEXT');
  await ensureColumn(database, 'users', 'widgetSecret', 'TEXT');
  await ensureColumn(database, 'widget_sessions', 'accessToken', 'TEXT');
}

async function initPostgresDb(database) {
  await database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      agencyname TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      twiliokey TEXT,
      gmailconfig TEXT,
      metaconfig TEXT,
      agentpersonality TEXT,
      logourl TEXT,
      calendarconfig TEXT,
      listingsdata TEXT,
      createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      userid INTEGER REFERENCES users(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      sessionid TEXT,
      channel TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      budget TEXT,
      timeline TEXT,
      location TEXT,
      propertytype TEXT,
      sentiment TEXT,
      intent TEXT,
      urgency TEXT,
      stagehistory TEXT,
      responseslaminutes INTEGER,
      intelligencesnapshot TEXT,
      aipaused INTEGER DEFAULT 0,
      createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updatedat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      leadid INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      direction TEXT NOT NULL,
      channel TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      sentbyai INTEGER DEFAULT 0,
      draftstate TEXT DEFAULT 'sent',
      confidence DOUBLE PRECISION,
      riskflags TEXT,
      orchestratordecision TEXT,
      intelligencesnapshot TEXT,
      externalsid TEXT,
      deliverystatus TEXT DEFAULT 'sent',
      error TEXT,
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      leadid INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      datetime TIMESTAMPTZ NOT NULL,
      property TEXT,
      status TEXT DEFAULT 'scheduled',
      notes TEXT,
      createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      leadid INTEGER REFERENCES leads(id) ON DELETE SET NULL,
      userid INTEGER REFERENCES users(id) ON DELETE SET NULL,
      leadname TEXT,
      action TEXT,
      channel TEXT,
      description TEXT,
      sentbyai INTEGER DEFAULT 0,
      timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS blocked_contacts (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      phone TEXT UNIQUE,
      reason TEXT,
      createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS webhook_events (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      channel TEXT NOT NULL,
      eventtype TEXT,
      payload TEXT,
      status TEXT DEFAULT 'received',
      error TEXT,
      createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS widget_sessions (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      sessionid TEXT UNIQUE NOT NULL,
      leadid INTEGER REFERENCES leads(id) ON DELETE SET NULL,
      agencyid TEXT,
      createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      lastseenat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS idempotency_keys (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      scope TEXT NOT NULL,
      key TEXT NOT NULL,
      requesthash TEXT NOT NULL,
      status TEXT DEFAULT 'processing',
      statuscode INTEGER,
      responsebody TEXT,
      createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      expiresat TIMESTAMPTZ,
      UNIQUE(scope, key)
    );

    CREATE TABLE IF NOT EXISTS followup_log (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      leadid INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      leadname TEXT,
      sequencestep INTEGER DEFAULT 1,
      channel TEXT,
      message TEXT,
      sentat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      userid INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      stripecustomerid TEXT,
      stripesubscriptionid TEXT,
      plan TEXT DEFAULT 'starter',
      status TEXT DEFAULT 'trialing',
      currentperiodend TIMESTAMPTZ,
      cancelatperiodend INTEGER DEFAULT 0,
      createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updatedat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_messages_lead_timestamp ON messages (leadid, timestamp DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_channel_timestamp ON messages (channel, timestamp DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_activity_log_timestamp ON activity_log (timestamp DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_blocked_phone ON blocked_contacts (phone);
    CREATE INDEX IF NOT EXISTS idx_widget_sessions_session ON widget_sessions (sessionid);
    CREATE INDEX IF NOT EXISTS idx_idempotency_scope_key ON idempotency_keys (scope, key);
    CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys (expiresat);
    CREATE INDEX IF NOT EXISTS idx_users_widget_id ON users (widgetid);
    CREATE INDEX IF NOT EXISTS idx_leads_user ON leads (userid);
    CREATE INDEX IF NOT EXISTS idx_messages_draft_state ON messages (draftstate);
    CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log (userid, timestamp DESC, id DESC);
  `);

  const ensureColumn = ensureColumnPostgres;

  await ensureColumn(database, 'leads', 'propertyType', 'TEXT');
  await ensureColumn(database, 'leads', 'sentiment', 'TEXT');
  await ensureColumn(database, 'leads', 'sessionId', 'TEXT');
  await ensureColumn(database, 'leads', 'userId', 'INTEGER REFERENCES users(id) ON DELETE SET NULL');
  await ensureColumn(database, 'leads', 'intent', 'TEXT');
  await ensureColumn(database, 'leads', 'urgency', 'TEXT');
  await ensureColumn(database, 'leads', 'stageHistory', 'TEXT');
  await ensureColumn(database, 'leads', 'responseSlaMinutes', 'INTEGER');
  await ensureColumn(database, 'leads', 'intelligenceSnapshot', 'TEXT');

  await ensureColumn(database, 'messages', 'externalSid', 'TEXT');
  await ensureColumn(database, 'messages', 'deliveryStatus', "TEXT DEFAULT 'sent'");
  await ensureColumn(database, 'messages', 'error', 'TEXT');
  await ensureColumn(database, 'messages', 'metadata', 'TEXT');
  await ensureColumn(database, 'messages', 'draftState', "TEXT DEFAULT 'sent'");
  await ensureColumn(database, 'messages', 'confidence', 'DOUBLE PRECISION');
  await ensureColumn(database, 'messages', 'riskFlags', 'TEXT');
  await ensureColumn(database, 'messages', 'orchestratorDecision', 'TEXT');
  await ensureColumn(database, 'messages', 'intelligenceSnapshot', 'TEXT');

  await ensureColumn(database, 'bookings', 'calendarEventId', 'TEXT');
  await ensureColumn(database, 'bookings', 'confirmedAt', 'TIMESTAMPTZ');
  await ensureColumn(database, 'bookings', 'cancelledAt', 'TIMESTAMPTZ');
  await ensureColumn(database, 'bookings', 'reminderSent', 'INTEGER DEFAULT 0');
  await ensureColumn(database, 'bookings', 'address', 'TEXT');
  await ensureColumn(database, 'bookings', 'clientEmail', 'TEXT');
  await ensureColumn(database, 'bookings', 'clientPhone', 'TEXT');

  await ensureColumn(database, 'leads', 'followupCount', 'INTEGER DEFAULT 0');
  await ensureColumn(database, 'leads', 'lastFollowupAt', 'TIMESTAMPTZ');
  await ensureColumn(database, 'leads', 'followupPaused', 'INTEGER DEFAULT 0');

  await ensureColumn(database, 'users', 'stripeCustomerId', 'TEXT');
  await ensureColumn(database, 'users', 'plan', "TEXT DEFAULT 'trial'");
  await ensureColumn(database, 'users', 'planStatus', "TEXT DEFAULT 'active'");
  await ensureColumn(database, 'users', 'planExpiresAt', 'TIMESTAMPTZ');
  await ensureColumn(database, 'users', 'onboardingComplete', 'INTEGER DEFAULT 0');
  await ensureColumn(database, 'users', 'greetingMessage', 'TEXT');
  await ensureColumn(database, 'users', 'widgetColor', "TEXT DEFAULT '#6C63FF'");
  await ensureColumn(database, 'users', 'metaConfig', 'TEXT');
  await ensureColumn(database, 'activity_log', 'userId', 'INTEGER REFERENCES users(id) ON DELETE SET NULL');
  await ensureColumn(database, 'users', 'selectedAgent', "TEXT DEFAULT 'salesbot'");
  await ensureColumn(database, 'users', 'role', "TEXT DEFAULT 'admin'");
  await ensureColumn(database, 'users', 'accentColor', "TEXT DEFAULT '#f97316'");
  await ensureColumn(database, 'users', 'slackWebhook', 'TEXT');
  await ensureColumn(database, 'users', 'notificationPrefs', "TEXT DEFAULT '{}'");
  await ensureColumn(database, 'leads', 'leadScore', 'INTEGER DEFAULT 0');
  await ensureColumn(database, 'leads', 'archived', 'INTEGER DEFAULT 0');
  await ensureColumn(database, 'users', 'widgetId', 'TEXT');
  await ensureColumn(database, 'users', 'widgetSecret', 'TEXT');
  await ensureColumn(database, 'widget_sessions', 'accessToken', 'TEXT');

  await database.exec(`
    CREATE OR REPLACE FUNCTION set_leads_updatedat()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updatedat = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS leads_updated_at ON leads;

    CREATE TRIGGER leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION set_leads_updatedat();
  `);
}

async function backfillWidgetCredentials(database) {
  const crypto = require('crypto');

  const usersWithoutWidget = await database.all("SELECT id FROM users WHERE widgetId IS NULL OR widgetId = ''");
  for (const row of usersWithoutWidget) {
    const widgetId = `wid_${crypto.randomBytes(12).toString('hex')}`;
    const widgetSecret = `whsec_${crypto.randomBytes(20).toString('hex')}`;
    await database.run('UPDATE users SET widgetId = ?, widgetSecret = ? WHERE id = ?', [widgetId, widgetSecret, row.id]);
  }

  const sessionsWithoutToken = await database.all("SELECT id FROM widget_sessions WHERE accessToken IS NULL OR accessToken = ''");
  for (const row of sessionsWithoutToken) {
    const accessToken = `ws_${crypto.randomBytes(18).toString('hex')}`;
    await database.run('UPDATE widget_sessions SET accessToken = ? WHERE id = ?', [accessToken, row.id]);
  }
}

async function initDb() {
  const database = await getDb();

  if (database.dialect === 'postgres') {
    await initPostgresDb(database);
  } else {
    await initSqliteDb(database);
  }

  await backfillWidgetCredentials(database);
}

module.exports = {
  getDb,
  initDb,
  isPostgres,
};
