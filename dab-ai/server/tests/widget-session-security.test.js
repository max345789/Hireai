const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const { initDb, getDb } = require('../db');
const { createApp } = require('../bootstrap/createApp');
const User = require('../models/User');

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

test('widget session history requires the issued access token and matching widget identity', async () => {
  await initDb();

  const unique = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const user = await User.create({
    agencyName: 'Widget Realty',
    email: `widget-${unique}@example.com`,
    password: 'hashed-password',
  });

  const server = await startServer();

  try {
    const createResponse = await fetch(`${server.baseUrl}/api/widget/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        widgetId: user.widgetId,
        agencyName: user.agencyName,
        visitorName: 'Security Test Lead',
      }),
    });

    assert.equal(createResponse.status, 201);
    const created = await createResponse.json();
    assert.ok(created.sessionId);
    assert.ok(created.accessToken);

    const missingTokenResponse = await fetch(
      `${server.baseUrl}/api/widget/messages/${encodeURIComponent(created.sessionId)}?widgetId=${encodeURIComponent(user.widgetId)}`
    );
    assert.equal(missingTokenResponse.status, 400);

    const wrongTokenResponse = await fetch(
      `${server.baseUrl}/api/widget/messages/${encodeURIComponent(created.sessionId)}?widgetId=${encodeURIComponent(user.widgetId)}&accessToken=ws_wrong`
    );
    assert.equal(wrongTokenResponse.status, 403);

    const validResponse = await fetch(
      `${server.baseUrl}/api/widget/messages/${encodeURIComponent(created.sessionId)}?widgetId=${encodeURIComponent(user.widgetId)}&accessToken=${encodeURIComponent(created.accessToken)}`
    );
    assert.equal(validResponse.status, 200);

    const restoredWithWrongToken = await fetch(`${server.baseUrl}/api/widget/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: created.sessionId,
        accessToken: 'ws_wrong',
        widgetId: user.widgetId,
        agencyName: user.agencyName,
      }),
    });
    assert.equal(restoredWithWrongToken.status, 403);
  } finally {
    await server.close();
  }
});
