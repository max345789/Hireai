const test = require('node:test');
const assert = require('node:assert/strict');

const twilioService = require('../services/twilioService');
const emailService = require('../services/emailService');

test('twilio parseIncoming detects image payload', () => {
  const parsed = twilioService.parseIncoming({
    From: 'whatsapp:+15551231234',
    Body: 'photo',
    NumMedia: '1',
    MediaContentType0: 'image/jpeg',
    MediaUrl0: 'https://example.com/image.jpg',
    MessageSid: 'SM123',
  });

  assert.equal(parsed.from, '+15551231234');
  assert.equal(parsed.messageType, 'image');
  assert.equal(parsed.twilioSid, 'SM123');
});

test('email cleanInboundEmailContent removes quoted block and signature', () => {
  const input = [
    'Hi team, please share options.',
    '',
    'On Tue, Jan 1, 2026 wrote:',
    '> quoted line',
    '-- ',
    'signature',
  ].join('\n');

  const output = emailService.cleanInboundEmailContent(input);
  assert.equal(output, 'Hi team, please share options.');
});
