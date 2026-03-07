const test = require('node:test');
const assert = require('node:assert/strict');

const { initDb } = require('../db');
const User = require('../models/User');

test('updateSettings persists extended account settings used by settings and onboarding flows', async () => {
  await initDb();

  const unique = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const user = await User.create({
    agencyName: 'Persistence Realty',
    email: `settings-${unique}@example.com`,
    password: 'hashed-password',
  });

  const updated = await User.updateSettings(user.id, {
    accentColor: '#123456',
    slackWebhook: 'https://hooks.slack.test/123',
    notificationPrefs: JSON.stringify({ inbox: true, bookings: false }),
    greetingMessage: 'Welcome to our property desk',
    widgetColor: '#abcdef',
    onboardingComplete: 1,
  });

  assert.equal(updated.accentColor, '#123456');
  assert.equal(updated.slackWebhook, 'https://hooks.slack.test/123');
  assert.equal(updated.notificationPrefs, JSON.stringify({ inbox: true, bookings: false }));
  assert.equal(updated.greetingMessage, 'Welcome to our property desk');
  assert.equal(updated.widgetColor, '#abcdef');
  assert.equal(updated.onboardingComplete, 1);
});
