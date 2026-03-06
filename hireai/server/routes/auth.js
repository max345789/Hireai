const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { env } = require('../config/env');
const { asString, asEmail } = require('../utils/validate');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      agencyName: user.agencyName,
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
    agentPersonality: user.agentPersonality,
    logoUrl: user.logoUrl,
    calendarConfig: user.calendarConfig,
    listingsData: user.listingsData,
    createdAt: user.createdAt,
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
      agentPersonality: asString(req.body?.agentPersonality, 'agentPersonality', { max: 2000 }),
      logoUrl: asString(req.body?.logoUrl, 'logoUrl', { max: 1024 }),
      calendarConfig: asString(req.body?.calendarConfig, 'calendarConfig', { max: 4000 }),
      listingsData: asString(req.body?.listingsData, 'listingsData', { max: 50000 }),
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

module.exports = router;
