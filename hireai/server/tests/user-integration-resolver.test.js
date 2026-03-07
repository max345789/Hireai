const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseTwilioConfig,
  parseGmailConfig,
  parseMetaConfig,
  getTwilioDeliveryConfig,
  getEmailDeliveryConfig,
  getMetaDeliveryConfig,
} = require('../services/userIntegrationResolver');

test('parseTwilioConfig supports JSON and legacy values', () => {
  const json = parseTwilioConfig(JSON.stringify({
    accountSid: 'AC123',
    authToken: 'secret',
    whatsappNumber: '+15550001111',
  }));

  assert.equal(json.accountSid, 'AC123');
  assert.equal(json.authToken, 'secret');
  assert.equal(json.whatsappNumber, '+15550001111');

  const legacy = parseTwilioConfig('legacy-key-only');
  assert.equal(legacy.legacyKey, 'legacy-key-only');
});

test('parseGmailConfig supports pipe format and JSON format', () => {
  const fromPipe = parseGmailConfig('agent@example.com|app-password');
  assert.equal(fromPipe.smtpUser, 'agent@example.com');
  assert.equal(fromPipe.smtpPass, 'app-password');

  const fromJson = parseGmailConfig(JSON.stringify({ smtpUser: 'json@example.com', smtpPass: 'json-pass' }));
  assert.equal(fromJson.smtpUser, 'json@example.com');
  assert.equal(fromJson.smtpPass, 'json-pass');
});

test('delivery config helpers map user settings safely', () => {
  const user = {
    twilioKey: JSON.stringify({ accountSid: 'AC1', authToken: 'T1', whatsappNumber: '+1555', smsNumber: '+1666' }),
    gmailConfig: 'mail@example.com|mail-pass',
    metaConfig: JSON.stringify({ accessToken: 'META_TOKEN', verifyToken: 'VERIFY', pageId: '12345' }),
  };

  const twilio = getTwilioDeliveryConfig(user);
  const gmail = getEmailDeliveryConfig(user);
  const meta = getMetaDeliveryConfig(user);

  assert.deepEqual(twilio, {
    accountSid: 'AC1',
    authToken: 'T1',
    whatsappNumber: '+1555',
    smsNumber: '+1666',
  });

  assert.deepEqual(gmail, {
    smtpUser: 'mail@example.com',
    smtpPass: 'mail-pass',
  });

  assert.deepEqual(meta, {
    accessToken: 'META_TOKEN',
    verifyToken: 'VERIFY',
    pageId: '12345',
  });

  assert.deepEqual(parseMetaConfig('{bad-json'), {});
});
