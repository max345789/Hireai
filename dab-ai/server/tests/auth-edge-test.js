/**
 * DAB AI — Auth Edge-to-Edge Test Suite
 * =====================================
 * Tests: register, login, /auth/me, password change, email change,
 *        edge cases, validation, duplicate detection, rate-limit paths
 *
 * Run:
 *   NODE_PATH=/sessions/trusting-inspiring-planck/mnt/dab-ai/server/node_modules \
 *   node --test auth-edge-test.js
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// ─── Resolve node_modules from the project ───────────────────────────────────
const NM = '/sessions/trusting-inspiring-planck/mnt/dab-ai/server/node_modules';
const SRC = '/sessions/trusting-inspiring-planck/mnt/dab-ai/server';

// Patch require so server modules resolve correctly without rebuilding sqlite3
const Module = require('module');
const _origResolve = Module._resolveFilename.bind(Module);
Module._resolveFilename = function (request, parent, isMain, options) {
  try {
    return _origResolve(request, parent, isMain, options);
  } catch (_) {
    // Try from the project's node_modules
    try {
      return _origResolve(
        `${NM}/${request}`,
        parent,
        isMain,
        options,
      );
    } catch (__) {
      return _origResolve(request, { id: `${NM}/stub`, filename: `${NM}/stub` }, isMain, options);
    }
  }
};

// Add project node_modules to the paths NODE uses
require('module').globalPaths.push(NM);

// ─── Mock database (in-memory) ───────────────────────────────────────────────
const IN_MEMORY_DB = {
  users: [],
  _nextId: 1,
};

const mockDb = {
  dialect: 'sqlite',
  async get(sql, params = []) {
    // Simple in-memory SQL-alike for users table
    if (/SELECT \* FROM users WHERE id = \?/.test(sql)) {
      return IN_MEMORY_DB.users.find((u) => u.id === params[0]) || null;
    }
    if (/SELECT \* FROM users WHERE email = \?/.test(sql)) {
      return IN_MEMORY_DB.users.find((u) => u.email === params[0]) || null;
    }
    if (/SELECT 1 AS ok/.test(sql)) return { ok: 1 };
    return null;
  },
  async all(sql, params = []) {
    return IN_MEMORY_DB.users;
  },
  async run(sql, params = []) {
    if (/INSERT INTO users/.test(sql)) {
      const [agencyName, email, password, twilioKey, gmailConfig, metaConfig,
             agentPersonality, logoUrl, calendarConfig, listingsData, widgetId, widgetSecret] = params;
      // Enforce UNIQUE constraint on email (simulate SQLite/Postgres behaviour)
      const duplicate = IN_MEMORY_DB.users.find((u) => u.email === email);
      if (duplicate) {
        const err = new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed: users.email');
        err.code = 'SQLITE_CONSTRAINT';
        throw err;
      }
      const id = IN_MEMORY_DB._nextId++;
      const user = {
        id,
        agencyName,
        email,
        password,
        twilioKey: twilioKey || null,
        gmailConfig: gmailConfig || null,
        metaConfig: metaConfig || null,
        agentPersonality: agentPersonality || null,
        logoUrl: logoUrl || null,
        calendarConfig: calendarConfig || null,
        listingsData: listingsData || null,
        widgetId,
        widgetSecret,
        plan: 'trial',
        planStatus: 'active',
        planExpiresAt: null,
        onboardingComplete: 0,
        greetingMessage: null,
        widgetColor: '#6C63FF',
        accentColor: '#f97316',
        selectedAgent: 'salesbot',
        role: 'admin',
        slackWebhook: null,
        notificationPrefs: '{}',
        createdAt: new Date().toISOString(),
      };
      IN_MEMORY_DB.users.push(user);
      return { lastID: id, changes: 1 };
    }
    if (/UPDATE users SET password = \? WHERE id = \?/.test(sql)) {
      const user = IN_MEMORY_DB.users.find((u) => u.id === params[1]);
      if (user) user.password = params[0];
      return { changes: 1 };
    }
    if (/UPDATE users SET email = \? WHERE id = \?/.test(sql)) {
      const user = IN_MEMORY_DB.users.find((u) => u.id === params[1]);
      if (user) user.email = params[0];
      return { changes: 1 };
    }
    if (/UPDATE users SET widgetSecret = \? WHERE id = \?/.test(sql)) {
      const user = IN_MEMORY_DB.users.find((u) => u.id === params[1]);
      if (user) user.widgetSecret = params[0];
      return { changes: 1 };
    }
    if (/UPDATE users\s+SET agencyName = \?/.test(sql)) {
      // Full settings update — last param is the user id
      const userId = params[params.length - 1];
      const user = IN_MEMORY_DB.users.find((u) => u.id === userId);
      if (!user) return { changes: 0 };
      const [agencyName, twilioKey, gmailConfig, metaConfig, agentPersonality, logoUrl,
             calendarConfig, listingsData, plan, planStatus, planExpiresAt, onboardingComplete,
             greetingMessage, widgetColor, stripeCustomerId, selectedAgent, accentColor,
             slackWebhook, notificationPrefs, widgetId, widgetSecret, role] = params;
      user.agencyName = agencyName ?? user.agencyName;
      user.twilioKey = twilioKey ?? user.twilioKey;
      user.gmailConfig = gmailConfig ?? user.gmailConfig;
      user.metaConfig = metaConfig ?? user.metaConfig;
      user.agentPersonality = agentPersonality ?? user.agentPersonality;
      user.logoUrl = logoUrl ?? user.logoUrl;
      user.calendarConfig = calendarConfig ?? user.calendarConfig;
      user.listingsData = listingsData ?? user.listingsData;
      user.plan = plan ?? user.plan;
      user.planStatus = planStatus ?? user.planStatus;
      user.planExpiresAt = planExpiresAt ?? user.planExpiresAt;
      user.onboardingComplete = onboardingComplete ?? user.onboardingComplete;
      user.greetingMessage = greetingMessage ?? user.greetingMessage;
      user.widgetColor = widgetColor ?? user.widgetColor;
      user.selectedAgent = selectedAgent ?? user.selectedAgent;
      user.accentColor = accentColor ?? user.accentColor;
      user.slackWebhook = slackWebhook ?? user.slackWebhook;
      user.notificationPrefs = notificationPrefs ?? user.notificationPrefs;
      user.widgetId = widgetId ?? user.widgetId;
      user.widgetSecret = widgetSecret ?? user.widgetSecret;
      user.role = role ?? user.role;
      return { changes: 1 };
    }
    return { lastID: null, changes: 0 };
  },
  async exec() {},
};

// ─── Inject mock into the module cache ───────────────────────────────────────
// Override db.js so getDb() returns our mock
const dbPath = require.resolve(`${SRC}/db.js`);
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    getDb: async () => mockDb,
    initDb: async () => {},
    isPostgres: () => false,
  },
};

// ─── Load app under test ──────────────────────────────────────────────────────
process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long!!';
process.env.NODE_ENV = 'test';
process.env.DB_PATH = '/tmp/test-dab-ai.db';

const { createApp } = require(`${SRC}/bootstrap/createApp`);

let dbReady = true;
const app = createApp({
  io: null,
  getDb: async () => mockDb,
  isDbReady: () => dbReady,
});

// ─── HTTP helper ──────────────────────────────────────────────────────────────
const http = require('http');

function request(app, method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const payload = body ? JSON.stringify(body) : null;
      const opts = {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': payload ? Buffer.byteLength(payload) : 0,
          ...headers,
        },
      };
      const req = http.request(opts, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          server.close();
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers });
          } catch {
            resolve({ status: res.statusCode, body: data, headers: res.headers });
          }
        });
      });
      req.on('error', (err) => { server.close(); reject(err); });
      if (payload) req.write(payload);
      req.end();
    });
  });
}

// ─── Reset DB between tests ───────────────────────────────────────────────────
function resetDb() {
  IN_MEMORY_DB.users = [];
  IN_MEMORY_DB._nextId = 1;
}

// =============================================================================
//  REGISTER TESTS
// =============================================================================

test('Register: ✅ happy path — creates user and returns token + user', async () => {
  resetDb();
  const res = await request(app, 'POST', '/api/auth/register', {
    agencyName: 'Acme Realty',
    email: 'alice@acme.com',
    password: 'Password123',
  });

  assert.equal(res.status, 201, `Expected 201 got ${res.status}: ${JSON.stringify(res.body)}`);
  assert.ok(res.body.token, 'Should return a JWT token');
  assert.ok(res.body.user, 'Should return user object');
  assert.equal(res.body.user.email, 'alice@acme.com');
  assert.equal(res.body.user.agencyName, 'Acme Realty');
  assert.equal(res.body.user.role, 'admin');
  assert.ok(!res.body.user.password, 'Password must NOT be in response');
  assert.equal(res.body.user.defaultChannels.web.connected, true, 'Web channel always connected');
});

test('Register: ✅ email normalised to lowercase', async () => {
  resetDb();
  const res = await request(app, 'POST', '/api/auth/register', {
    agencyName: 'Acme Realty',
    email: 'BOB@ACME.COM',
    password: 'Password123',
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.user.email, 'bob@acme.com');
});

test('Register: ✅ widgetId and widgetSecret generated on creation', async () => {
  resetDb();
  const res = await request(app, 'POST', '/api/auth/register', {
    agencyName: 'Widget Co',
    email: 'widget@test.com',
    password: 'Password123',
  });
  assert.equal(res.status, 201);
  assert.ok(res.body.user.widgetId?.startsWith('wid_'), 'widgetId should have wid_ prefix');
  assert.ok(res.body.user.widgetSecret?.startsWith('whsec_'), 'widgetSecret should have whsec_ prefix');
});

test('Register: ❌ duplicate email returns 409', async () => {
  resetDb();
  await request(app, 'POST', '/api/auth/register', {
    agencyName: 'First',
    email: 'dup@test.com',
    password: 'Password123',
  });
  const res = await request(app, 'POST', '/api/auth/register', {
    agencyName: 'Second',
    email: 'dup@test.com',
    password: 'Password456',
  });
  assert.equal(res.status, 409);
  assert.ok(res.body.error?.includes('already exists'), `Got: ${res.body.error}`);
});

test('Register: ❌ missing email returns 400', async () => {
  resetDb();
  const res = await request(app, 'POST', '/api/auth/register', {
    agencyName: 'Test',
    password: 'Password123',
  });
  assert.equal(res.status, 400);
  assert.ok(res.body.error?.toLowerCase().includes('email'), `Got: ${res.body.error}`);
});

test('Register: ❌ invalid email format returns 400', async () => {
  resetDb();
  const res = await request(app, 'POST', '/api/auth/register', {
    agencyName: 'Test',
    email: 'not-an-email',
    password: 'Password123',
  });
  assert.equal(res.status, 400);
});

test('Register: ❌ password too short (< 8 chars) returns 400', async () => {
  resetDb();
  const res = await request(app, 'POST', '/api/auth/register', {
    agencyName: 'Test',
    email: 'user@test.com',
    password: 'short',
  });
  assert.equal(res.status, 400);
  assert.ok(res.body.error?.toLowerCase().includes('password'), `Got: ${res.body.error}`);
});

test('Register: ❌ missing agencyName returns 400', async () => {
  resetDb();
  const res = await request(app, 'POST', '/api/auth/register', {
    email: 'user@test.com',
    password: 'Password123',
  });
  assert.equal(res.status, 400);
});

test('Register: ❌ agencyName too short (< 2 chars) returns 400', async () => {
  resetDb();
  const res = await request(app, 'POST', '/api/auth/register', {
    agencyName: 'X',
    email: 'user@test.com',
    password: 'Password123',
  });
  assert.equal(res.status, 400);
});

test('Register: ❌ empty body returns 400', async () => {
  resetDb();
  const res = await request(app, 'POST', '/api/auth/register', {});
  assert.equal(res.status, 400);
});

test('Register: ❌ password too long (> 128 chars) returns 400', async () => {
  resetDb();
  const res = await request(app, 'POST', '/api/auth/register', {
    agencyName: 'Test',
    email: 'user@test.com',
    password: 'a'.repeat(129),
  });
  assert.equal(res.status, 400);
});

test('Register: ✅ JWT token is valid and contains expected claims', async () => {
  resetDb();
  const res = await request(app, 'POST', '/api/auth/register', {
    agencyName: 'JWT Test',
    email: 'jwt@test.com',
    password: 'Password123',
  });
  assert.equal(res.status, 201);
  const jwt = require(`${NM}/jsonwebtoken`);
  const decoded = jwt.verify(res.body.token, 'test-secret-at-least-32-chars-long!!');
  assert.equal(decoded.email, 'jwt@test.com');
  assert.equal(decoded.role, 'admin');
  assert.ok(decoded.id, 'Token should have user id');
});

// =============================================================================
//  LOGIN TESTS
// =============================================================================

test('Login: ✅ happy path — returns token + user', async () => {
  resetDb();
  await request(app, 'POST', '/api/auth/register', {
    agencyName: 'Login Co',
    email: 'login@test.com',
    password: 'Password123',
  });
  const res = await request(app, 'POST', '/api/auth/login', {
    email: 'login@test.com',
    password: 'Password123',
  });
  assert.equal(res.status, 200);
  assert.ok(res.body.token, 'Should return JWT token');
  assert.equal(res.body.user.email, 'login@test.com');
});

test('Login: ✅ email is case-insensitive', async () => {
  resetDb();
  await request(app, 'POST', '/api/auth/register', {
    agencyName: 'Case Co',
    email: 'case@test.com',
    password: 'Password123',
  });
  const res = await request(app, 'POST', '/api/auth/login', {
    email: 'CASE@TEST.COM',
    password: 'Password123',
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.user.email, 'case@test.com');
});

test('Login: ❌ wrong password returns 401', async () => {
  resetDb();
  await request(app, 'POST', '/api/auth/register', {
    agencyName: 'Wrong Pass',
    email: 'wrong@test.com',
    password: 'CorrectPass123',
  });
  const res = await request(app, 'POST', '/api/auth/login', {
    email: 'wrong@test.com',
    password: 'WrongPass123',
  });
  assert.equal(res.status, 401);
  assert.ok(res.body.error?.toLowerCase().includes('invalid'), `Got: ${res.body.error}`);
});

test('Login: ❌ non-existent user returns 401', async () => {
  resetDb();
  const res = await request(app, 'POST', '/api/auth/login', {
    email: 'ghost@test.com',
    password: 'Password123',
  });
  assert.equal(res.status, 401);
  assert.ok(res.body.error?.toLowerCase().includes('invalid'));
});

test('Login: ❌ missing password returns 400', async () => {
  resetDb();
  const res = await request(app, 'POST', '/api/auth/login', {
    email: 'user@test.com',
  });
  assert.equal(res.status, 400);
});

test('Login: ❌ missing email returns 400', async () => {
  resetDb();
  const res = await request(app, 'POST', '/api/auth/login', {
    password: 'Password123',
  });
  assert.equal(res.status, 400);
});

test('Login: ❌ invalid email format returns 400', async () => {
  resetDb();
  const res = await request(app, 'POST', '/api/auth/login', {
    email: 'bad-email',
    password: 'Password123',
  });
  assert.equal(res.status, 400);
});

test('Login: ❌ empty body returns 400', async () => {
  resetDb();
  const res = await request(app, 'POST', '/api/auth/login', {});
  assert.equal(res.status, 400);
});

test('Login: ❌ SQL injection attempt in email is safely rejected', async () => {
  resetDb();
  const res = await request(app, 'POST', '/api/auth/login', {
    email: "' OR '1'='1",
    password: 'anything',
  });
  // Should be caught by email validation (not a valid email format)
  assert.equal(res.status, 400);
});

test('Login: ❌ password with only spaces returns 400 or 401', async () => {
  resetDb();
  await request(app, 'POST', '/api/auth/register', {
    agencyName: 'Space Test',
    email: 'space@test.com',
    password: 'ValidPass123',
  });
  const res = await request(app, 'POST', '/api/auth/login', {
    email: 'space@test.com',
    password: '        ',  // spaces only — gets trimmed to empty string
  });
  // Should fail: empty string after trim triggers required check
  assert.ok([400, 401].includes(res.status), `Expected 400 or 401, got ${res.status}`);
});

test('Login: ✅ response does not expose password hash', async () => {
  resetDb();
  await request(app, 'POST', '/api/auth/register', {
    agencyName: 'Secure Corp',
    email: 'secure@test.com',
    password: 'Password123',
  });
  const res = await request(app, 'POST', '/api/auth/login', {
    email: 'secure@test.com',
    password: 'Password123',
  });
  assert.equal(res.status, 200);
  assert.ok(!res.body.user.password, 'Password hash must not be in response');
});

// =============================================================================
//  /auth/me TESTS
// =============================================================================

test('/auth/me: ✅ returns user when valid token provided', async () => {
  resetDb();
  const reg = await request(app, 'POST', '/api/auth/register', {
    agencyName: 'Me Corp',
    email: 'me@test.com',
    password: 'Password123',
  });
  const token = reg.body.token;

  const res = await request(app, 'GET', '/api/auth/me', null, {
    Authorization: `Bearer ${token}`,
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.user.email, 'me@test.com');
});

test('/auth/me: ❌ no token returns 401', async () => {
  resetDb();
  const res = await request(app, 'GET', '/api/auth/me', null);
  assert.equal(res.status, 401);
});

test('/auth/me: ❌ tampered token returns 401', async () => {
  resetDb();
  const res = await request(app, 'GET', '/api/auth/me', null, {
    Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJpZCI6OTk5OX0.fakesignature',
  });
  assert.equal(res.status, 401);
});

test('/auth/me: ❌ expired token returns 401', async () => {
  resetDb();
  const jwt = require(`${NM}/jsonwebtoken`);
  const expiredToken = jwt.sign(
    { id: 1, email: 'x@x.com', role: 'admin' },
    'test-secret-at-least-32-chars-long!!',
    { expiresIn: '-1s' }
  );
  const res = await request(app, 'GET', '/api/auth/me', null, {
    Authorization: `Bearer ${expiredToken}`,
  });
  assert.equal(res.status, 401);
});

// =============================================================================
//  PASSWORD CHANGE TESTS
// =============================================================================

test('Change Password: ✅ happy path', async () => {
  resetDb();
  const reg = await request(app, 'POST', '/api/auth/register', {
    agencyName: 'Pass Corp',
    email: 'pass@test.com',
    password: 'OldPassword1',
  });
  const token = reg.body.token;

  const res = await request(app, 'PATCH', '/api/auth/password', {
    currentPassword: 'OldPassword1',
    newPassword: 'NewPassword2',
  }, { Authorization: `Bearer ${token}` });

  assert.equal(res.status, 200);
  assert.ok(res.body.success);

  // Verify old password no longer works
  const loginOld = await request(app, 'POST', '/api/auth/login', {
    email: 'pass@test.com',
    password: 'OldPassword1',
  });
  assert.equal(loginOld.status, 401, 'Old password should be rejected');

  // Verify new password works
  const loginNew = await request(app, 'POST', '/api/auth/login', {
    email: 'pass@test.com',
    password: 'NewPassword2',
  });
  assert.equal(loginNew.status, 200, 'New password should work');
});

test('Change Password: ❌ wrong current password returns 401', async () => {
  resetDb();
  const reg = await request(app, 'POST', '/api/auth/register', {
    agencyName: 'WrongPass',
    email: 'wrongpass@test.com',
    password: 'CorrectPass1',
  });
  const token = reg.body.token;

  const res = await request(app, 'PATCH', '/api/auth/password', {
    currentPassword: 'WrongPass1',
    newPassword: 'NewPassword2',
  }, { Authorization: `Bearer ${token}` });

  assert.equal(res.status, 401);
});

test('Change Password: ❌ new password too short returns 400', async () => {
  resetDb();
  const reg = await request(app, 'POST', '/api/auth/register', {
    agencyName: 'ShortPass',
    email: 'short@test.com',
    password: 'ValidPass1',
  });
  const token = reg.body.token;

  const res = await request(app, 'PATCH', '/api/auth/password', {
    currentPassword: 'ValidPass1',
    newPassword: 'short',
  }, { Authorization: `Bearer ${token}` });

  assert.equal(res.status, 400);
});

test('Change Password: ❌ unauthenticated request returns 401', async () => {
  resetDb();
  const res = await request(app, 'PATCH', '/api/auth/password', {
    currentPassword: 'OldPass123',
    newPassword: 'NewPass123',
  });
  assert.equal(res.status, 401);
});

// =============================================================================
//  EMAIL CHANGE TESTS
// =============================================================================

test('Change Email: ✅ happy path returns new token', async () => {
  resetDb();
  const reg = await request(app, 'POST', '/api/auth/register', {
    agencyName: 'Email Corp',
    email: 'old@test.com',
    password: 'Password123',
  });
  const token = reg.body.token;

  const res = await request(app, 'PATCH', '/api/auth/email', {
    newEmail: 'new@test.com',
    password: 'Password123',
  }, { Authorization: `Bearer ${token}` });

  assert.equal(res.status, 200);
  assert.ok(res.body.token, 'Should return new token');
  assert.equal(res.body.user.email, 'new@test.com');
});

test('Change Email: ❌ wrong password returns 401', async () => {
  resetDb();
  const reg = await request(app, 'POST', '/api/auth/register', {
    agencyName: 'Email2',
    email: 'email2@test.com',
    password: 'RealPass123',
  });
  const token = reg.body.token;

  const res = await request(app, 'PATCH', '/api/auth/email', {
    newEmail: 'other@test.com',
    password: 'WrongPass',
  }, { Authorization: `Bearer ${token}` });

  assert.equal(res.status, 401);
});

test('Change Email: ❌ email already in use returns 409', async () => {
  resetDb();
  // Create two users
  const reg1 = await request(app, 'POST', '/api/auth/register', {
    agencyName: 'User1', email: 'user1@test.com', password: 'Password123',
  });
  await request(app, 'POST', '/api/auth/register', {
    agencyName: 'User2', email: 'user2@test.com', password: 'Password456',
  });
  const token = reg1.body.token;

  // Try to change user1's email to user2's email
  const res = await request(app, 'PATCH', '/api/auth/email', {
    newEmail: 'user2@test.com',
    password: 'Password123',
  }, { Authorization: `Bearer ${token}` });

  assert.equal(res.status, 409);
});

// =============================================================================
//  SETTINGS TESTS
// =============================================================================

test('Settings GET: ✅ returns settings for authenticated user', async () => {
  resetDb();
  const reg = await request(app, 'POST', '/api/auth/register', {
    agencyName: 'Settings Co',
    email: 'settings@test.com',
    password: 'Password123',
  });
  const token = reg.body.token;

  const res = await request(app, 'GET', '/api/settings', null, {
    Authorization: `Bearer ${token}`,
  });
  assert.equal(res.status, 200);
  assert.ok(res.body.settings);
  assert.equal(res.body.settings.email, 'settings@test.com');
});

test('Settings PATCH: ✅ updates agencyName', async () => {
  resetDb();
  const reg = await request(app, 'POST', '/api/auth/register', {
    agencyName: 'Old Name',
    email: 'settingsupdate@test.com',
    password: 'Password123',
  });
  const token = reg.body.token;

  // Patch settings
  const res = await request(app, 'PATCH', '/api/settings', {
    agencyName: 'New Name Corp',
  }, { Authorization: `Bearer ${token}` });

  assert.equal(res.status, 200);
  assert.equal(res.body.settings.agencyName, 'New Name Corp');
});

// =============================================================================
//  HEALTH / INFRASTRUCTURE TESTS
// =============================================================================

test('Health: ✅ /api/health returns ok', async () => {
  resetDb();
  const res = await request(app, 'GET', '/api/health', null);
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.service, 'dab-ai-server');
});

test('Health: ✅ /api/ready returns ok when db is ready', async () => {
  resetDb();
  const res = await request(app, 'GET', '/api/ready', null);
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
});

test('404: ❌ unknown route returns 404', async () => {
  resetDb();
  const res = await request(app, 'GET', '/api/does-not-exist', null);
  assert.equal(res.status, 404);
});

// =============================================================================
//  SECURITY / EDGE CASE TESTS
// =============================================================================

test('Security: ✅ register with extremely long agencyName is rejected', async () => {
  resetDb();
  const res = await request(app, 'POST', '/api/auth/register', {
    agencyName: 'A'.repeat(121),
    email: 'long@test.com',
    password: 'Password123',
  });
  assert.equal(res.status, 400);
});

test('Security: ✅ Bearer token with wrong signing key rejected', async () => {
  resetDb();
  const jwt = require(`${NM}/jsonwebtoken`);
  const fakeToken = jwt.sign(
    { id: 1, email: 'fake@test.com', role: 'admin' },
    'different-secret-key-not-used'
  );
  const res = await request(app, 'GET', '/api/auth/me', null, {
    Authorization: `Bearer ${fakeToken}`,
  });
  assert.equal(res.status, 401);
});

test('Security: ✅ password is bcrypt-hashed and not stored in plain text', async () => {
  resetDb();
  await request(app, 'POST', '/api/auth/register', {
    agencyName: 'BCrypt Test',
    email: 'bcrypt@test.com',
    password: 'MyPassword123',
  });
  const stored = IN_MEMORY_DB.users.find((u) => u.email === 'bcrypt@test.com');
  assert.ok(stored, 'User should exist in DB');
  assert.notEqual(stored.password, 'MyPassword123', 'Password should not be plain text');
  assert.ok(stored.password.startsWith('$2'), 'Password should be bcrypt hash');
});

test('Security: ✅ two different passwords produce different hashes', async () => {
  resetDb();
  await request(app, 'POST', '/api/auth/register', {
    agencyName: 'Hash1', email: 'hash1@test.com', password: 'Password111',
  });
  await request(app, 'POST', '/api/auth/register', {
    agencyName: 'Hash2', email: 'hash2@test.com', password: 'Password222',
  });
  const user1 = IN_MEMORY_DB.users.find((u) => u.email === 'hash1@test.com');
  const user2 = IN_MEMORY_DB.users.find((u) => u.email === 'hash2@test.com');
  assert.notEqual(user1.password, user2.password, 'Different passwords = different hashes');
});

test('Security: ✅ widgetSecret not returned for non-admin role tokens', async () => {
  resetDb();
  const jwt = require(`${NM}/jsonwebtoken`);
  // Register normally
  const reg = await request(app, 'POST', '/api/auth/register', {
    agencyName: 'Role Test',
    email: 'role@test.com',
    password: 'Password123',
  });

  // Craft a token with role: 'user'
  const userToken = jwt.sign(
    { id: reg.body.user.id, email: 'role@test.com', role: 'user' },
    'test-secret-at-least-32-chars-long!!'
  );

  const res = await request(app, 'GET', '/api/auth/me', null, {
    Authorization: `Bearer ${userToken}`,
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.user.widgetSecret, undefined, 'widgetSecret must not be exposed to non-admin');
});

test('Concurrent: ✅ simultaneous registrations with different emails all succeed', async () => {
  resetDb();
  const emails = ['c1@test.com', 'c2@test.com', 'c3@test.com', 'c4@test.com', 'c5@test.com'];
  const results = await Promise.all(
    emails.map((email) =>
      request(app, 'POST', '/api/auth/register', {
        agencyName: `Agency for ${email}`,
        email,
        password: 'Password123',
      })
    )
  );
  for (const res of results) {
    assert.equal(res.status, 201, `Expected 201 got ${res.status}`);
  }
  assert.equal(IN_MEMORY_DB.users.length, 5, 'All 5 users should be created');
});

test('Duplicate: ✅ sequential same-email registration — second attempt always rejected', async () => {
  // This tests the real database UNIQUE constraint behavior (sequentially).
  // Concurrent TOCTOU protection relies on DB-level UNIQUE constraints in production.
  resetDb();

  const res1 = await request(app, 'POST', '/api/auth/register', {
    agencyName: 'First Agency',
    email: 'sequential@test.com',
    password: 'Password123',
  });
  assert.equal(res1.status, 201, 'First registration should succeed');

  const res2 = await request(app, 'POST', '/api/auth/register', {
    agencyName: 'Second Agency',
    email: 'sequential@test.com',
    password: 'Password456',
  });
  assert.equal(res2.status, 409, 'Second registration with same email should return 409');
  assert.ok(res2.body.error?.toLowerCase().includes('already'), `Error: ${res2.body.error}`);

  // Verify only 1 user record exists
  assert.equal(
    IN_MEMORY_DB.users.filter((u) => u.email === 'sequential@test.com').length,
    1,
    'Only one user record should exist in the database'
  );
});

console.log('\n🧪 DAB AI Auth Edge-to-Edge Test Suite — All tests queued!\n');
