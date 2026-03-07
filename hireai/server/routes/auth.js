const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { env } = require('../config/env');
const { asString, asEmail } = require('../utils/validate');
const { getDb } = require('../db');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      agencyName: user.agencyName,
      role: user.role || 'admin',
    },
    env.jwtSecret,
    { expiresIn: env.jwtAccessTtl }
  );
}

function sanitizeUser(user) {
  return {
    id: user.id,
    agencyName: user.agencyName,
    email: user.email,
    twilioKey: user.twilioKey,
    gmailConfig: user.gmailConfig,
    metaConfig: user.metaConfig,
    agentPersonality: user.agentPersonality,
    logoUrl: user.logoUrl,
    calendarConfig: user.calendarConfig,
    listingsData: user.listingsData,
    plan: user.plan,
    planStatus: user.planStatus,
    planExpiresAt: user.planExpiresAt,
    createdAt: user.createdAt,
    selectedAgent: user.selectedAgent || 'salesbot',
    role: user.role || 'admin',
    accentColor: user.accentColor || '#f97316',
    slackWebhook: user.slackWebhook,
    notificationPrefs: user.notificationPrefs,
    widgetId: user.widgetId || null,
    // widgetSecret only exposed to account admins — never to regular users
    widgetSecret: user.role === 'admin' ? (user.widgetSecret || null) : undefined,
    // Auto-channel status: web widget is always connected
    defaultChannels: {
      web: { connected: true, mode: 'native' },
      whatsapp: { connected: Boolean(user.twilioKey), mode: user.twilioKey ? 'live' : 'demo' },
      email: { connected: Boolean(user.gmailConfig), mode: user.gmailConfig ? 'live' : 'demo' },
      instagram: { connected: Boolean(user.metaConfig), mode: user.metaConfig ? 'live' : 'off' },
      messenger: { connected: Boolean(user.metaConfig), mode: user.metaConfig ? 'live' : 'off' },
      calendar: { connected: Boolean(user.calendarConfig), mode: user.calendarConfig ? 'live' : 'off' },
    },
  };
}

router.post('/auth/register', async (req, res) => {
  try {
    const agencyName = asString(req.body?.agencyName, 'agencyName', { required: true, min: 2, max: 120 });
    const email = asEmail(req.body?.email, 'email', { required: true });
    const password = asString(req.body?.password, 'password', { required: true, min: 8, max: 128 });

    const exists = await User.findByEmail(email.toLowerCase());
    if (exists) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      agencyName,
      email: email.toLowerCase(),
      password: hashed,
      agentPersonality: 'Warm, concise, and proactive real estate assistant',
    });

    return res.status(201).json({
      token: signToken(user),
      user: sanitizeUser(user),
    });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    console.error('register failed', error);
    return res.status(500).json({ error: 'Failed to register user' });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const email = asEmail(req.body?.email, 'email', { required: true });
    const password = asString(req.body?.password, 'password', { required: true, min: 1, max: 128 });

    const user = await User.findByEmail(email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    return res.json({ token: signToken(user), user: sanitizeUser(user) });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    console.error('login failed', error);
    return res.status(500).json({ error: 'Failed to login' });
  }
});

router.get('/auth/me', requireAuth, async (req, res) => {
  const user = await User.getById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({ user: sanitizeUser(user) });
});

router.get('/settings', requireAuth, async (req, res) => {
  const user = await User.getById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({ settings: sanitizeUser(user) });
});

router.patch('/settings', requireAuth, async (req, res) => {
  try {
    const updates = {
      agencyName: asString(req.body?.agencyName, 'agencyName', { max: 120 }),
      twilioKey: asString(req.body?.twilioKey, 'twilioKey', { max: 500 }),
      gmailConfig: asString(req.body?.gmailConfig, 'gmailConfig', { max: 1000 }),
      metaConfig: asString(req.body?.metaConfig, 'metaConfig', { max: 5000 }),
      agentPersonality: asString(req.body?.agentPersonality, 'agentPersonality', { max: 2000 }),
      logoUrl: asString(req.body?.logoUrl, 'logoUrl', { max: 1024 }),
      calendarConfig: asString(req.body?.calendarConfig, 'calendarConfig', { max: 4000 }),
      listingsData: asString(req.body?.listingsData, 'listingsData', { max: 50000 }),
      accentColor: asString(req.body?.accentColor, 'accentColor', { max: 30 }),
      slackWebhook: asString(req.body?.slackWebhook, 'slackWebhook', { max: 500 }),
      notificationPrefs: req.body?.notificationPrefs != null ? JSON.stringify(req.body.notificationPrefs) : undefined,
    };

    const user = await User.updateSettings(req.user.id, updates);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ settings: sanitizeUser(user) });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    console.error('settings update failed', error);
    return res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Change password
router.patch('/auth/password', requireAuth, async (req, res) => {
  try {
    const currentPassword = asString(req.body?.currentPassword, 'currentPassword', { required: true, min: 1, max: 128 });
    const newPassword = asString(req.body?.newPassword, 'newPassword', { required: true, min: 8, max: 128 });

    const user = await User.getById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(newPassword, 10);
    const db = await getDb();
    await db.run('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);

    return res.json({ success: true });
  } catch (err) {
    if (err?.name === 'ValidationError') return res.status(400).json({ error: err.message });
    console.error('change password failed', err);
    return res.status(500).json({ error: 'Failed to change password' });
  }
});

// Change email
router.patch('/auth/email', requireAuth, async (req, res) => {
  try {
    const newEmail = asEmail(req.body?.newEmail, 'newEmail', { required: true });
    const password = asString(req.body?.password, 'password', { required: true, min: 1, max: 128 });

    const user = await User.getById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Password is incorrect' });

    const normalizedEmail = newEmail.toLowerCase();
    const existing = await User.findByEmail(normalizedEmail);
    if (existing && existing.id !== user.id) return res.status(409).json({ error: 'Email already in use' });

    const db = await getDb();
    await db.run('UPDATE users SET email = ? WHERE id = ?', [normalizedEmail, req.user.id]);

    const updated = await User.getById(req.user.id);
    return res.json({ token: signToken(updated), user: sanitizeUser(updated) });
  } catch (err) {
    if (err?.name === 'ValidationError') return res.status(400).json({ error: err.message });
    console.error('change email failed', err);
    return res.status(500).json({ error: 'Failed to change email' });
  }
});

// Regenerate widget secret (keeps widgetId, rotates widgetSecret only)
router.post('/widget-credentials/regenerate', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { widgetSecret } = User.generateWidgetCredentials();
    const db = await getDb();
    await db.run('UPDATE users SET widgetSecret = ? WHERE id = ?', [widgetSecret, req.user.id]);
    const user = await User.getById(req.user.id);
    return res.json({ widgetId: user.widgetId, widgetSecret: user.widgetSecret });
  } catch (err) {
    console.error('regenerate widget secret failed', err.message);
    return res.status(500).json({ error: 'Failed to regenerate widget secret' });
  }
});

module.exports = router;
