require('dotenv').config();

const bcrypt = require('bcryptjs');
const { initDb, getDb } = require('./db');

async function run() {
  await initDb();
  const db = await getDb();

  await db.exec(`
    DELETE FROM widget_sessions;
    DELETE FROM webhook_events;
    DELETE FROM blocked_contacts;
    DELETE FROM activity_log;
    DELETE FROM bookings;
    DELETE FROM messages;
    DELETE FROM leads;
    DELETE FROM users;
    DELETE FROM sqlite_sequence WHERE name IN ('widget_sessions', 'webhook_events', 'blocked_contacts', 'activity_log', 'bookings', 'messages', 'leads', 'users');
  `);

  const password = await bcrypt.hash('password123', 10);
  const user = await db.run(
    `INSERT INTO users (agencyName, email, password, agentPersonality, twilioKey, gmailConfig, listingsData)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      'HireAI Demo Realty',
      'admin@hireai.local',
      password,
      'Friendly, decisive and concise',
      'connected',
      'connected',
      'Downtown Loft, 2BHK River View, Suburban Villa',
    ]
  );

  const now = Date.now();
  const hoursAgo = (h) => new Date(now - h * 3600 * 1000).toISOString();

  const leads = [
    { name: 'Ahmed Khan', phone: '+15551010001', channel: 'whatsapp', status: 'qualified', budget: '$350k', timeline: '2 months', location: 'Downtown', propertyType: 'apartment', sentiment: 'positive' },
    { name: 'Sarah Miller', email: 'sarah@example.com', channel: 'email', status: 'booked', budget: '$520k', timeline: 'Immediate', location: 'Riverside', propertyType: 'apartment', sentiment: 'neutral' },
    { name: 'James Lee', phone: '+15551010003', channel: 'sms', status: 'new', budget: null, timeline: null, location: null, propertyType: null, sentiment: 'neutral' },
    { name: 'Priya Nair', email: 'priya@example.com', channel: 'webchat', status: 'qualified', budget: '$420k', timeline: '3 months', location: 'Tech Park', propertyType: 'villa', sentiment: 'positive' },
    { name: 'Carlos Diaz', phone: '+15551010005', channel: 'whatsapp', status: 'escalated', budget: '$640k', timeline: 'Completed', location: 'Lakeside', propertyType: 'villa', sentiment: 'negative' },
  ];

  const leadIds = [];
  for (const lead of leads) {
    const inserted = await db.run(
      `INSERT INTO leads (name, phone, email, channel, status, budget, timeline, location, propertyType, sentiment, aiPaused, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        lead.name,
        lead.phone || null,
        lead.email || null,
        lead.channel,
        lead.status,
        lead.budget,
        lead.timeline,
        lead.location,
        lead.propertyType,
        lead.sentiment,
        0,
        hoursAgo(48),
        hoursAgo(1),
      ]
    );

    leadIds.push(inserted.lastID);
  }

  const messages = [
    { leadId: leadIds[0], direction: 'in', channel: 'whatsapp', content: 'Hi, I need a 2 bedroom apartment near downtown.', sentByAI: 0, timestamp: hoursAgo(4) },
    { leadId: leadIds[0], direction: 'out', channel: 'whatsapp', content: 'Absolutely. Could you share your budget and preferred move-in timeline?', sentByAI: 1, timestamp: hoursAgo(3.9) },
    { leadId: leadIds[1], direction: 'in', channel: 'email', content: 'Can I see the river view condo tomorrow?', sentByAI: 0, timestamp: hoursAgo(5) },
    { leadId: leadIds[1], direction: 'out', channel: 'email', content: 'Yes, I have a slot at 3:00 PM tomorrow. Shall I confirm?', sentByAI: 1, timestamp: hoursAgo(4.8) },
    { leadId: leadIds[2], direction: 'in', channel: 'sms', content: 'What is the minimum down payment?', sentByAI: 0, timestamp: hoursAgo(2) },
    { leadId: leadIds[3], direction: 'in', channel: 'webchat', content: 'Need villa options in Tech Park area.', sentByAI: 0, timestamp: hoursAgo(6) },
    { leadId: leadIds[3], direction: 'out', channel: 'webchat', content: 'Sure. Are you targeting 3BHK or 4BHK and what is your budget range?', sentByAI: 1, timestamp: hoursAgo(5.7) },
    { leadId: leadIds[4], direction: 'in', channel: 'whatsapp', content: 'I am really upset with delayed response.', sentByAI: 0, timestamp: hoursAgo(24) },
  ];

  for (const msg of messages) {
    await db.run(
      `INSERT INTO messages (leadId, direction, channel, content, sentByAI, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [msg.leadId, msg.direction, msg.channel, msg.content, msg.sentByAI, msg.timestamp]
    );
  }

  await db.run(
    `INSERT INTO bookings (leadId, dateTime, property, status, notes)
     VALUES (?, ?, ?, ?, ?)`,
    [leadIds[1], new Date(now + 24 * 3600 * 1000).toISOString(), 'River View Condo', 'scheduled', 'Booked by AI assistant']
  );

  const logs = [
    { leadId: leadIds[0], leadName: 'Ahmed Khan', action: 'qualified', channel: 'whatsapp', description: 'Replied to Ahmed and collected budget/timeline', timestamp: hoursAgo(3.9) },
    { leadId: leadIds[1], leadName: 'Sarah Miller', action: 'booked', channel: 'email', description: 'Booked viewing for Sarah at 3 PM tomorrow', timestamp: hoursAgo(4.8) },
    { leadId: leadIds[2], leadName: 'James Lee', action: 'followed_up', channel: 'sms', description: 'Sent follow-up to James after inactivity', timestamp: hoursAgo(1.9) },
    { leadId: leadIds[3], leadName: 'Priya Nair', action: 'replied', channel: 'webchat', description: 'Replied to Priya and asked qualification questions', timestamp: hoursAgo(5.6) },
    { leadId: leadIds[4], leadName: 'Carlos Diaz', action: 'escalated', channel: 'whatsapp', description: 'Escalated Carlos to human due to negative sentiment', timestamp: hoursAgo(23.5) },
  ];

  for (const log of logs) {
    await db.run(
      `INSERT INTO activity_log (leadId, leadName, action, channel, description, sentByAI, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [log.leadId, log.leadName, log.action, log.channel, log.description, 1, log.timestamp]
    );
  }

  console.log('Seed complete.');
  console.log(`Demo login: admin@hireai.local / password123 (user id ${user.lastID})`);
}

run().catch((error) => {
  console.error('Seed failed', error);
  process.exit(1);
});
