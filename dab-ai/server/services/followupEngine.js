const { getDb } = require('../db');
const Message = require('../models/Message');
const ActivityLog = require('../models/ActivityLog');
const { processMessage } = require('./agentBrain');

/**
 * Follow-up Engine
 * Runs scheduled sweeps to re-engage cold leads and send booking reminders.
 *
 * Sequence:
 *   Step 1 — 24 h after last inbound → gentle nudge
 *   Step 2 — 48 h after last inbound → different angle
 *   Step 3 — 72 h after last inbound → mark cold, notify human
 *   Booking reminder — 24 h before viewing
 *   Post-viewing — next day after viewing
 */

function hoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

async function logFollowup(db, { leadId, leadName, step, channel, message }) {
  await db.run(
    `INSERT INTO followup_log (leadId, leadName, sequenceStep, channel, message) VALUES (?, ?, ?, ?, ?)`,
    [leadId, leadName, step, channel, message]
  );
}

/**
 * Sweep leads that haven't replied in 24+ hours and need a follow-up.
 */
async function sweepInactiveLeads(io) {
  const db = await getDb();

  const leads = await db.all(
    `SELECT l.*,
            m.timestamp AS lastMsgAt,
            m.direction AS lastMsgDir,
            (SELECT COUNT(*) FROM followup_log fl WHERE fl.leadId = l.id) AS followupCount
     FROM leads l
     LEFT JOIN messages m ON m.id = (
       SELECT id FROM messages WHERE leadId = l.id ORDER BY timestamp DESC, id DESC LIMIT 1
     )
     WHERE l.aiPaused = 0
       AND l.followupPaused = 0
       AND l.status IN ('new', 'qualified')
       AND m.direction = 'in'
       AND m.timestamp <= ?
     LIMIT 30`,
    [hoursAgo(24)]
  );

  for (const lead of leads) {
    const followupCount = Number(lead.followupCount || 0);
    const history = await Message.getByLeadId(lead.id);

    if (followupCount === 0) {
      // Step 1: gentle nudge
      const prompt = `The lead ${lead.name} has not replied in over 24 hours. Send a warm, non-pushy follow-up to check if they still need help finding a property.`;
      await processMessage(prompt, lead, history.slice(-8), { io, channel: lead.channel });
      await logFollowup(db, { leadId: lead.id, leadName: lead.name, step: 1, channel: lead.channel, message: prompt });
      await db.run(`UPDATE leads SET lastFollowupAt = CURRENT_TIMESTAMP WHERE id = ?`, [lead.id]);

    } else if (followupCount === 1 && lead.lastMsgAt <= hoursAgo(48)) {
      // Step 2: different angle
      const prompt = `The lead ${lead.name} has still not replied after 48 hours. Try a different angle — mention urgency of market, or ask if their requirements have changed.`;
      await processMessage(prompt, lead, history.slice(-8), { io, channel: lead.channel });
      await logFollowup(db, { leadId: lead.id, leadName: lead.name, step: 2, channel: lead.channel, message: prompt });
      await db.run(`UPDATE leads SET lastFollowupAt = CURRENT_TIMESTAMP WHERE id = ?`, [lead.id]);

    } else if (followupCount === 2 && lead.lastMsgAt <= hoursAgo(72)) {
      // Step 3: mark cold
      await db.run(`UPDATE leads SET status = 'closed', followupPaused = 1 WHERE id = ?`, [lead.id]);
      const activity = await ActivityLog.create({
        leadId: lead.id,
        leadName: lead.name,
        action: 'needs_human',
        channel: lead.channel,
        description: `Lead ${lead.name} marked cold after 72h of no response. Human follow-up recommended.`,
        sentByAI: true,
      });
      if (io) io.emit('agent:action', activity);
      if (io) io.emit('agent:escalated', { leadId: lead.id, leadName: lead.name, reason: 'No reply after 72 hours — marked cold.', channel: lead.channel });
    }
  }
}

/**
 * Sweep upcoming bookings and send 24-hour reminders.
 */
async function sweepBookingReminders(io) {
  const db = await getDb();

  const bookings = await db.all(
    `SELECT b.*, l.name AS leadName, l.channel AS leadChannel, l.email AS leadEmail, l.phone AS leadPhone
     FROM bookings b
     JOIN leads l ON l.id = b.leadId
     WHERE b.status = 'scheduled'
       AND b.reminderSent = 0
       AND b.dateTime > ?
       AND b.dateTime <= ?`,
    [new Date().toISOString(), hoursFromNow(25)]
  );

  for (const booking of bookings) {
    const lead = {
      id: booking.leadId,
      name: booking.leadName,
      channel: booking.leadChannel,
      email: booking.leadEmail,
      phone: booking.leadPhone,
    };

    const when = new Date(booking.dateTime).toLocaleString();
    const prompt = `The lead ${booking.leadName} has a property viewing scheduled for ${when}. Send them a friendly reminder message about their upcoming viewing.`;
    const history = await Message.getByLeadId(booking.leadId);
    await processMessage(prompt, lead, history.slice(-5), { io, channel: lead.channel });
    await db.run(`UPDATE bookings SET reminderSent = 1 WHERE id = ?`, [booking.id]);

    const activity = await ActivityLog.create({
      leadId: booking.leadId,
      leadName: booking.leadName,
      action: 'followed_up',
      channel: lead.channel,
      description: `Sent viewing reminder to ${booking.leadName} for ${when}`,
      sentByAI: true,
    });
    if (io) io.emit('agent:action', activity);
  }
}

/**
 * Sweep completed viewings and send post-viewing follow-ups.
 */
async function sweepPostViewingFollowups(io) {
  const db = await getDb();

  const bookings = await db.all(
    `SELECT b.*, l.name AS leadName, l.channel AS leadChannel, l.email AS leadEmail, l.phone AS leadPhone
     FROM bookings b
     JOIN leads l ON l.id = b.leadId
     WHERE b.status = 'scheduled'
       AND b.reminderSent = 1
       AND b.dateTime < ?
       AND b.dateTime >= ?`,
    [new Date().toISOString(), hoursAgo(36)]
  );

  for (const booking of bookings) {
    const lead = {
      id: booking.leadId,
      name: booking.leadName,
      channel: booking.leadChannel,
      email: booking.leadEmail,
      phone: booking.leadPhone,
    };

    const prompt = `The lead ${booking.leadName} had a property viewing yesterday. Send them a warm post-viewing follow-up to ask how it went and if they would like to proceed.`;
    const history = await Message.getByLeadId(booking.leadId);
    await processMessage(prompt, lead, history.slice(-5), { io, channel: lead.channel });
    await db.run(`UPDATE bookings SET status = 'completed' WHERE id = ?`, [booking.id]);

    const activity = await ActivityLog.create({
      leadId: booking.leadId,
      leadName: booking.leadName,
      action: 'followed_up',
      channel: lead.channel,
      description: `Sent post-viewing follow-up to ${booking.leadName}`,
      sentByAI: true,
    });
    if (io) io.emit('agent:action', activity);
  }
}

/**
 * Run all sweeps — called by cron scheduler.
 */
async function runAllSweeps(io) {
  try {
    await sweepInactiveLeads(io);
  } catch (error) {
    console.error('[FollowupEngine] sweepInactiveLeads failed:', error.message);
  }

  try {
    await sweepBookingReminders(io);
  } catch (error) {
    console.error('[FollowupEngine] sweepBookingReminders failed:', error.message);
  }

  try {
    await sweepPostViewingFollowups(io);
  } catch (error) {
    console.error('[FollowupEngine] sweepPostViewingFollowups failed:', error.message);
  }
}

async function getFollowupLog(leadId) {
  const db = await getDb();
  if (leadId) {
    return db.all(`SELECT * FROM followup_log WHERE leadId = ? ORDER BY sentAt DESC`, [leadId]);
  }
  return db.all(`SELECT * FROM followup_log ORDER BY sentAt DESC LIMIT 100`);
}

module.exports = {
  runAllSweeps,
  getFollowupLog,
};
