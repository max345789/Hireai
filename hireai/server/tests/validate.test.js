const test = require('node:test');
const assert = require('node:assert/strict');

const {
  asString,
  asEnum,
  asInteger,
  asEmail,
  asPhone,
  safeLimit,
} = require('../utils/validate');

test('asString enforces required', () => {
  assert.throws(() => asString('', 'message', { required: true }), /message is required/);
  assert.equal(asString(' hello ', 'message', { required: true }), 'hello');
});

test('asEnum validates allowed values', () => {
  assert.equal(asEnum('email', 'channel', ['email', 'whatsapp']), 'email');
  assert.throws(() => asEnum('sms', 'channel', ['email', 'whatsapp']), /channel must be one of/);
});

test('asInteger validates numeric bounds', () => {
  assert.equal(asInteger('10', 'leadId', { min: 1 }), 10);
  assert.throws(() => asInteger('0', 'leadId', { min: 1 }), /leadId must be between/);
});

test('asEmail and asPhone normalize', () => {
  assert.equal(asEmail('TEST@Example.COM', 'email'), 'test@example.com');
  assert.equal(asPhone('+1 555 000 1111', 'phone'), '+15550001111');
});

test('safeLimit clamps values', () => {
  assert.equal(safeLimit('40', 10, 100), 40);
  assert.equal(safeLimit('500', 10, 100), 100);
  assert.equal(safeLimit('-1', 10, 100), 10);
});
