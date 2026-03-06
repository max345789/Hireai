const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      agencyName: user.agencyName,
    },
    process.env.JWT_SECRET || 'hireai-dev-secret',
    { expiresIn: '7d' }
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
    const { agencyName, email, password } = req.body;

    if (!agencyName || !email || !password) {
      return res.status(400).json({ error: 'agencyName, email and password are required' });
    }

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
    console.error('register failed', error);
    return res.status(500).json({ error: 'Failed to register user' });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

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
  const user = await User.updateSettings(req.user.id, req.body || {});
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({ settings: sanitizeUser(user) });
});

module.exports = router;
