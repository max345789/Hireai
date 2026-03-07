const express = require('express');
const jwt = require('jsonwebtoken');
const Booking = require('../models/Booking');
const Lead = require('../models/Lead');
const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');
const calendarService = require('../services/calendarService');
const { requireAuth } = require('../middleware/auth');
const { env } = require('../config/env');

const router = express.Router();

router.get('/bookings', requireAuth, async (_req, res) => {
  try {
    const bookings = (await Booking.all()).filter((item) => !item.leadUserId || Number(item.leadUserId) === Number(_req.user.id));
    return res.json({ bookings });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/bookings/upcoming', requireAuth, async (req, res) => {
  try {
    const bookings = (await Booking.upcoming(Number(req.query.days) || 7))
      .filter((item) => !item.leadUserId || Number(item.leadUserId) === Number(req.user.id));
    return res.json({ bookings });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/bookings/available-slots', requireAuth, async (req, res) => {
  try {
    const user = await User.getById(req.user.id);
    const slots = await calendarService.getAvailableSlots(user?.calendarConfig, Number(req.query.days) || 7);
    return res.json({ slots });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/bookings', requireAuth, async (req, res) => {
  try {
    const { leadId, dateTime, property, status, notes, address, clientEmail, clientPhone } = req.body;
    if (!leadId || !dateTime) return res.status(400).json({ error: 'leadId and dateTime are required' });

    const lead = await Lead.getById(leadId);
    if (!lead || (lead.userId && Number(lead.userId) !== Number(req.user.id))) return res.status(404).json({ error: 'Lead not found' });

    const booking = await Booking.create({ leadId, dateTime, property, status, notes, address, clientEmail: clientEmail || lead.email, clientPhone: clientPhone || lead.phone });

    const user = await User.getById(req.user.id);
    const calResult = await calendarService.createEvent(user?.calendarConfig, {
      summary: `Property Viewing — ${lead.name}`,
      description: notes || `Viewing for ${lead.name}`,
      start: dateTime,
      location: address || '',
      attendeeEmail: clientEmail || lead.email,
    });
    if (calResult?.id) await Booking.update(booking.id, { calendarEventId: calResult.id });

    const activity = await ActivityLog.create({ leadId, leadName: lead.name, action: 'booked', channel: lead.channel, description: `Booked viewing for ${lead.name} at ${new Date(dateTime).toLocaleString()}`, sentByAI: false });

    const io = req.app.get('io');
    io.emit('booking:created', { ...booking, leadName: lead.name, leadChannel: lead.channel });
    io.emit('agent:action', activity);

    return res.status(201).json({ booking, activity, calendarLink: calResult?.htmlLink || null });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.patch('/bookings/:id', requireAuth, async (req, res) => {
  try {
    const existing = await Booking.getById(Number(req.params.id));
    if (!existing || (existing.leadUserId && Number(existing.leadUserId) !== Number(req.user.id))) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    const booking = await Booking.update(Number(req.params.id), req.body);
    req.app.get('io').emit('booking:updated', booking);
    return res.json({ booking });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/bookings/:id/confirm', requireAuth, async (req, res) => {
  try {
    const existing = await Booking.getById(Number(req.params.id));
    if (!existing || (existing.leadUserId && Number(existing.leadUserId) !== Number(req.user.id))) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    const booking = await Booking.confirm(Number(req.params.id));
    const activity = await ActivityLog.create({ leadId: booking.leadId, leadName: booking.leadName, action: 'booked', channel: booking.leadChannel || 'web', description: `Confirmed viewing for ${booking.leadName}`, sentByAI: false });
    const io = req.app.get('io');
    io.emit('booking:updated', booking);
    io.emit('agent:action', activity);
    return res.json({ booking });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/bookings/:id/cancel', requireAuth, async (req, res) => {
  try {
    const existing = await Booking.getById(Number(req.params.id));
    if (!existing || (existing.leadUserId && Number(existing.leadUserId) !== Number(req.user.id))) return res.status(404).json({ error: 'Booking not found' });
    if (existing.calendarEventId) {
      const user = await User.getById(req.user.id);
      await calendarService.deleteEvent(user?.calendarConfig, existing.calendarEventId);
    }
    const booking = await Booking.cancel(Number(req.params.id));
    const activity = await ActivityLog.create({ leadId: booking.leadId, leadName: booking.leadName, action: 'needs_human', channel: booking.leadChannel || 'web', description: `Cancelled viewing for ${booking.leadName}`, sentByAI: false });
    const io = req.app.get('io');
    io.emit('booking:updated', booking);
    io.emit('agent:action', activity);
    return res.json({ booking });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/calendar/auth-url', requireAuth, async (req, res) => {
  try {
    const user = await User.getById(req.user.id);
    const url = calendarService.getAuthUrl(user?.calendarConfig);
    if (!url) return res.status(400).json({ error: 'Add clientId and clientSecret to calendarConfig in Settings first.' });
    return res.json({ url });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/calendar/oauth/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) return res.status(400).send('Missing code');
    let user = null;

    if (state) {
      try {
        const decoded = jwt.verify(state, env.jwtSecret);
        if (decoded?.userId) {
          user = await User.getById(decoded.userId);
        }
      } catch {
        user = null;
      }
    }

    if (!user) {
      user = await User.firstUser();
    }

    if (!user) return res.status(404).send('User not found');
    const updatedConfig = await calendarService.exchangeCode(user.calendarConfig, code);
    await User.updateSettings(user.id, { calendarConfig: updatedConfig });
    return res.send('<html><body style="font-family:sans-serif;background:#0A0A0F;color:#fff;padding:40px;text-align:center"><h2>✅ Google Calendar Connected!</h2><p>You can close this window.</p></body></html>');
  } catch (error) {
    return res.status(500).send(`Error: ${error.message}`);
  }
});

module.exports = router;
