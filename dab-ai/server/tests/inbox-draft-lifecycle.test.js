const test = require('node:test');
const assert = require('node:assert/strict');

const { initDb } = require('../db');
const User = require('../models/User');
const Lead = require('../models/Lead');
const Message = require('../models/Message');

test('message draft lifecycle supports pending approval to approved sent', async () => {
  await initDb();

  const unique = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const user = await User.create({
    agencyName: 'Test Agency',
    email: `draft-${unique}@example.com`,
    password: 'hashed-password',
  });

  const lead = await Lead.create({
    userId: user.id,
    name: 'Draft Lead',
    channel: 'web',
    status: 'new',
  });

  let message = await Message.create({
    leadId: lead.id,
    direction: 'out',
    channel: 'web',
    content: 'Initial AI draft',
    sentByAI: true,
    draftState: 'pending_approval',
    deliveryStatus: 'draft',
    confidence: 0.61,
    riskFlags: ['low_confidence'],
  });

  assert.equal(message.draftState, 'pending_approval');
  assert.equal(message.deliveryStatus, 'draft');

  message = await Message.updateDraft(message.id, {
    content: 'Edited and approved copy',
    draftState: 'approved',
  });

  assert.equal(message.content, 'Edited and approved copy');
  assert.equal(message.draftState, 'approved');

  message = await Message.updateDelivery(message.id, {
    deliveryStatus: 'sent',
    draftState: 'approved_sent',
  });

  assert.equal(message.deliveryStatus, 'sent');
  assert.equal(message.draftState, 'approved_sent');
});
