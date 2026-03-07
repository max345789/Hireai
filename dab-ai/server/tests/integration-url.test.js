const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const jwt = require('jsonwebtoken');

const { initDb, getDb } = require('../db');
const { createApp } = require('../bootstrap/createApp');
const User = require('../models/User');
const { env } = require('../config/env');

async function startServer() {
  const app = createApp({
    io: null,
    getDb,
    isDbReady: () => true,
  });

  const server = http.createServer(app);

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

test('google integration callback URL uses request origin instead of localhost fallback', async () => {
  await initDb();

  const previousClientId = process.env.GOOGLE_CLIENT_ID;
  const previousClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const previousBaseUrl = env.baseUrl;

  process.env.GOOGLE_CLIENT_ID = 'google-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
  env.baseUrl = null;

  const unique = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const user = await User.create({
    agencyName: 'OAuth Realty',
    email: `oauth-${unique}@example.com`,
    password: 'hashed-password',
  });

  const token = jwt.sign({ id: user.id, email: user.email, role: 'admin' }, env.jwtSecret, { expiresIn: '10m' });
  const server = await startServer();

  try {
    const response = await fetch(`${server.baseUrl}/api/integrations/google/connect`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Forwarded-Proto': 'https',
        'X-Forwarded-Host': 'stage.example.com',
      },
      body: JSON.stringify({}),
    });

    assert.equal(response.status, 200);
    const payload = await response.json();

    assert.match(payload.url, /https%3A%2F%2Fstage\.example\.com%2Fapi%2Fintegrations%2Fgoogle%2Fcallback/);
    assert.doesNotMatch(payload.url, /localhost/);
  } finally {
    process.env.GOOGLE_CLIENT_ID = previousClientId;
    process.env.GOOGLE_CLIENT_SECRET = previousClientSecret;
    env.baseUrl = previousBaseUrl;
    await server.close();
  }
});
