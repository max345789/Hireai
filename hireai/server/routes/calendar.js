const express = require('express');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { env } = require('../config/env');
const User = require('../models/User');
const calendarService = require('../services/calendarService');

const router = express.Router();

/**
 * Build the base OAuth2 config from server env vars.
 * Credentials (clientId / clientSecret) come from env — never from the DB.
 */
function buildBaseConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = env.baseUrl || 'http://localhost:3001';
  const redirectUri = `${baseUrl}/api/calendar/oauth/callback`;
  return { clientId, clientSecret, redirectUri };
}

/** Resolve the frontend base URL for post-OAuth redirects */
function frontendBaseUrl() {
  if (env.isProd) {
    return env.corsOrigins[0] || 'https://hireai-1-adh0.onrender.com';
  }
  return 'http://localhost:3000';
}

// ─── GET /api/calendar/status ──────────────────────────────────────────────
router.get('/calendar/status', requireAuth, async (req, res) => {
  try {
    const user = await User.getById(req.user.id);
    const hasServerCreds = Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    );

    let connected = false;
    if (user?.calendarConfig) {
      try {
        const parsed = JSON.parse(user.calendarConfig);
        connected = Boolean(parsed.tokens?.access_token);
      } catch { /* ignore bad JSON */ }
    }

    return res.json({ connected, hasServerCreds });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/calendar/oauth/url ──────────────────────────────────────────
// Returns the Google OAuth authorization URL. Frontend redirects the user there.
router.get('/calendar/oauth/url', requireAuth, (req, res) => {
  const { clientId, clientSecret, redirectUri } = buildBaseConfig();

  if (!clientId || !clientSecret) {
    return res.status(400).json({
      error:
        'Google Calendar is not configured on this server. ' +
        'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.',
    });
  }

  const configJson = JSON.stringify({ clientId, clientSecret, redirectUri });
  let authUrl = calendarService.getAuthUrl(configJson);

  if (!authUrl) {
    return res.status(500).json({ error: 'Failed to generate Google OAuth URL.' });
  }

  // Embed a short-lived signed token so the callback knows which user to update
  const state = jwt.sign({ userId: req.user.id }, env.jwtSecret, { expiresIn: '10m' });
  authUrl = `${authUrl}&state=${encodeURIComponent(state)}`;

  return res.json({ url: authUrl });
});

// ─── GET /api/calendar/oauth/callback ─────────────────────────────────────
// Google redirects here after the user grants permission.
// Exchanges the code for tokens, stores them, then redirects to the frontend.
router.get('/calendar/oauth/callback', async (req, res) => {
  const { code, state, error: oauthError } = req.query;
  const frontend = frontendBaseUrl();

  if (oauthError) {
    return res.redirect(
      `${frontend}/settings?calendar_error=${encodeURIComponent(oauthError)}`
    );
  }

  if (!code || !state) {
    return res.redirect(`${frontend}/settings?calendar_error=missing_params`);
  }

  try {
    const { userId } = jwt.verify(state, env.jwtSecret);
    const { clientId, clientSecret, redirectUri } = buildBaseConfig();
    const configJson = JSON.stringify({ clientId, clientSecret, redirectUri });

    // Exchange code → tokens; returns updated JSON with tokens embedded
    const newConfigJson = await calendarService.exchangeCode(configJson, code);

    // Write directly to avoid User.updateSettings null-coalescing issue
    const db = await getDb();
    await db.run('UPDATE users SET calendarConfig = ? WHERE id = ?', [newConfigJson, userId]);

    return res.redirect(`${frontend}/settings?calendar_connected=1`);
  } catch (err) {
    console.error('[Calendar] OAuth callback error:', err.message);
    return res.redirect(
      `${frontend}/settings?calendar_error=${encodeURIComponent(err.message)}`
    );
  }
});

// ─── POST /api/calendar/disconnect ────────────────────────────────────────
router.post('/calendar/disconnect', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    await db.run('UPDATE users SET calendarConfig = NULL WHERE id = ?', [req.user.id]);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
