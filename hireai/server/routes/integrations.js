const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const calendarService = require('../services/calendarService');
const metaService = require('../services/metaService');
const twilioService = require('../services/twilioService');
const emailService = require('../services/emailService');
const { requireAuth } = require('../middleware/auth');
const { env } = require('../config/env');
const {
  parseTwilioConfig,
  parseGmailConfig,
  parseMetaConfig,
} = require('../services/userIntegrationResolver');

const router = express.Router();

function parseJson(raw, fallback = null) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function baseUrl() {
  return env.baseUrl || `http://localhost:${env.port || 3001}`;
}

function frontendUrl() {
  if (env.isProd) return env.corsOrigins[0] || 'https://hireai-1-adh0.onrender.com';
  return 'http://localhost:3000';
}

function buildGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${baseUrl()}/api/integrations/google/callback`;
  return { clientId, clientSecret, redirectUri };
}

function buildMetaOAuthUrl(state) {
  const appId = process.env.META_APP_ID;
  const redirectUri = `${baseUrl()}/api/integrations/meta/callback`;
  if (!appId) return null;
  const scope = encodeURIComponent('pages_messaging,instagram_basic,pages_manage_metadata');
  return `https://www.facebook.com/v19.0/dialog/oauth?client_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&state=${encodeURIComponent(state)}&scope=${scope}&response_type=code`;
}

router.get('/integrations', requireAuth, async (req, res) => {
  const user = await User.getById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const twilioConfig = parseTwilioConfig(user.twilioKey);
  const gmailConfig = parseGmailConfig(user.gmailConfig);
  const metaConfig = parseMetaConfig(user.metaConfig);

  let calendarConnected = false;
  if (user.calendarConfig) {
    const parsed = parseJson(user.calendarConfig, {});
    calendarConnected = Boolean(parsed?.tokens?.access_token);
  }

  return res.json({
    providers: {
      whatsapp: {
        connected: twilioService.isConfigured(twilioConfig) || Boolean(user.twilioKey),
        mode: 'key_fallback',
      },
      email: {
        connected: emailService.isConfigured(gmailConfig) || Boolean(user.gmailConfig),
        mode: 'key_fallback',
      },
      web: {
        connected: true,
        mode: 'native',
      },
      instagram: {
        connected: Boolean(metaConfig?.accessToken) || metaService.isConfigured(metaConfig),
        mode: process.env.META_APP_ID ? 'oauth_or_key' : 'key_fallback',
      },
      messenger: {
        connected: Boolean(metaConfig?.accessToken) || metaService.isConfigured(metaConfig),
        mode: process.env.META_APP_ID ? 'oauth_or_key' : 'key_fallback',
      },
      google: {
        connected: calendarConnected,
        mode: process.env.GOOGLE_CLIENT_ID ? 'oauth' : 'disabled',
      },
    },
  });
});

router.post('/integrations/:provider/connect', requireAuth, async (req, res) => {
  const provider = String(req.params.provider || '').toLowerCase();

  if (provider === 'whatsapp') {
    const payload = {
      accountSid: req.body?.accountSid || null,
      authToken: req.body?.authToken || null,
      whatsappNumber: req.body?.whatsappNumber || null,
      smsNumber: req.body?.smsNumber || null,
      configuredAt: new Date().toISOString(),
    };

    const user = await User.updateSettings(req.user.id, { twilioKey: JSON.stringify(payload) });
    return res.json({ success: true, provider, mode: 'key_fallback', settings: user });
  }

  if (provider === 'email') {
    const smtpUser = String(req.body?.smtpUser || '').trim();
    const smtpPass = String(req.body?.smtpPass || '').trim();
    if (!smtpUser || !smtpPass) {
      return res.status(400).json({ error: 'smtpUser and smtpPass are required' });
    }

    const user = await User.updateSettings(req.user.id, {
      gmailConfig: `${smtpUser}|${smtpPass}`,
    });

    return res.json({ success: true, provider, mode: 'key_fallback', settings: user });
  }

  if (provider === 'google') {
    const cfg = buildGoogleConfig();
    if (!cfg.clientId || !cfg.clientSecret) {
      return res.status(400).json({
        error: 'Google OAuth not configured on server',
      });
    }

    const state = jwt.sign({ userId: req.user.id, provider: 'google' }, env.jwtSecret, { expiresIn: '10m' });
    const authUrl = calendarService.getAuthUrl(JSON.stringify(cfg));

    if (!authUrl) {
      return res.status(500).json({ error: 'Unable to build Google OAuth URL' });
    }

    return res.json({
      success: true,
      provider,
      mode: 'oauth',
      url: `${authUrl}&state=${encodeURIComponent(state)}`,
    });
  }

  if (provider === 'meta' || provider === 'instagram' || provider === 'messenger') {
    const normalizedProvider = provider === 'meta' ? 'meta' : provider;

    if (req.body?.accessToken) {
      const user = await User.getById(req.user.id);
      const current = parseJson(user?.metaConfig, {});
      const next = {
        ...current,
        accessToken: req.body.accessToken,
        pageId: req.body.pageId || current.pageId || null,
        verifyToken: req.body.verifyToken || current.verifyToken || null,
        configuredAt: new Date().toISOString(),
      };
      const updated = await User.updateSettings(req.user.id, {
        metaConfig: JSON.stringify(next),
      });

      return res.json({ success: true, provider: normalizedProvider, mode: 'key_fallback', settings: updated });
    }

    const state = jwt.sign({ userId: req.user.id, provider: normalizedProvider }, env.jwtSecret, { expiresIn: '10m' });
    const url = buildMetaOAuthUrl(state);

    if (!url) {
      return res.status(400).json({
        error: 'Meta OAuth app is not configured. Provide accessToken directly.',
      });
    }

    return res.json({ success: true, provider: normalizedProvider, mode: 'oauth', url });
  }

  if (provider === 'web') {
    return res.json({ success: true, provider, mode: 'native' });
  }

  return res.status(400).json({ error: 'Unsupported integration provider' });
});

async function handleIntegrationCallback(req, res) {
  const provider = String(req.params.provider || '').toLowerCase();
  const code = req.body?.code || req.query?.code;
  const state = req.body?.state || req.query?.state;
  const shouldRedirect = req.method === 'GET' || Boolean(req.query?.redirect || req.body?.redirect);

  if (!state) {
    if (shouldRedirect) return res.redirect(`${frontendUrl()}/inbox?integration_error=missing_state`);
    return res.status(400).json({ error: 'Missing state' });
  }

  let decoded;
  try {
    decoded = jwt.verify(state, env.jwtSecret);
  } catch {
    if (shouldRedirect) return res.redirect(`${frontendUrl()}/inbox?integration_error=invalid_state`);
    return res.status(400).json({ error: 'Invalid state token' });
  }

  const userId = Number(decoded?.userId || 0);
  if (!userId) {
    if (shouldRedirect) return res.redirect(`${frontendUrl()}/inbox?integration_error=invalid_user`);
    return res.status(400).json({ error: 'Invalid user in state' });
  }

  if (provider === 'google') {
    if (!code) {
      if (shouldRedirect) return res.redirect(`${frontendUrl()}/inbox?google_error=missing_code`);
      return res.status(400).json({ error: 'Missing code' });
    }

    try {
      const cfg = buildGoogleConfig();
      const updatedCfg = await calendarService.exchangeCode(JSON.stringify(cfg), code);
      await User.updateSettings(userId, { calendarConfig: updatedCfg });

      if (shouldRedirect) {
        return res.redirect(`${frontendUrl()}/inbox?google_connected=1`);
      }

      return res.json({ success: true, provider: 'google' });
    } catch (error) {
      if (shouldRedirect) {
        return res.redirect(`${frontendUrl()}/inbox?google_error=${encodeURIComponent(error.message)}`);
      }
      return res.status(500).json({ error: error.message });
    }
  }

  if (provider === 'meta' || provider === 'instagram' || provider === 'messenger') {
    const user = await User.getById(userId);
    const current = parseJson(user?.metaConfig, {});
    let next = {
      ...current,
      oauthCode: code || null,
      oauthState: state,
      configuredAt: new Date().toISOString(),
    };

    if (code && process.env.META_APP_ID && process.env.META_APP_SECRET) {
      try {
        const redirectUri = `${baseUrl()}/api/integrations/meta/callback`;
        const tokenData = await metaService.exchangeCodeForUserToken({
          code,
          redirectUri,
          appId: process.env.META_APP_ID,
          appSecret: process.env.META_APP_SECRET,
        });

        const userAccessToken = tokenData?.access_token || null;
        const pages = await metaService.getManagedPages(userAccessToken);
        const firstPage = pages[0] || null;

        next = {
          ...next,
          accessToken: firstPage?.access_token || userAccessToken || null,
          pageId: firstPage?.id || current.pageId || null,
          tokenType: tokenData?.token_type || null,
          tokenExpiresIn: tokenData?.expires_in || null,
          oauthError: null,
        };
      } catch (error) {
        next = {
          ...next,
          oauthError: error.message,
        };
      }
    }

    await User.updateSettings(userId, { metaConfig: JSON.stringify(next) });

    if (shouldRedirect) {
      if (next.accessToken) {
        return res.redirect(`${frontendUrl()}/inbox?meta_connected=1`);
      }
      return res.redirect(
        `${frontendUrl()}/inbox?meta_error=${encodeURIComponent(next.oauthError || 'oauth_incomplete')}`
      );
    }

    return res.json({
      success: true,
      provider,
      connected: Boolean(next.accessToken),
      note: next.accessToken
        ? 'Meta OAuth connected successfully.'
        : 'OAuth callback recorded, but token exchange did not complete.',
    });
  }

  return res.status(400).json({ error: 'Unsupported integration callback provider' });
}

router.post('/integrations/:provider/callback', handleIntegrationCallback);
router.get('/integrations/:provider/callback', handleIntegrationCallback);

router.post('/integrations/:provider/disconnect', requireAuth, async (req, res) => {
  const provider = String(req.params.provider || '').toLowerCase();

  if (provider === 'whatsapp') {
    const user = await User.updateSettings(req.user.id, { twilioKey: null });
    return res.json({ success: true, provider, settings: user });
  }

  if (provider === 'email') {
    const user = await User.updateSettings(req.user.id, { gmailConfig: null });
    return res.json({ success: true, provider, settings: user });
  }

  if (provider === 'google') {
    const user = await User.updateSettings(req.user.id, { calendarConfig: null });
    return res.json({ success: true, provider, settings: user });
  }

  if (provider === 'meta' || provider === 'instagram' || provider === 'messenger') {
    const user = await User.updateSettings(req.user.id, { metaConfig: null });
    return res.json({ success: true, provider, settings: user });
  }

  if (provider === 'web') {
    return res.json({ success: true, provider, note: 'Web integration is always enabled' });
  }

  return res.status(400).json({ error: 'Unsupported integration provider' });
});

module.exports = router;
