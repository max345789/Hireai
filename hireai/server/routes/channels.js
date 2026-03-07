const express = require('express');
const twilioService = require('../services/twilioService');
const emailService = require('../services/emailService');
const metaService = require('../services/metaService');
const Message = require('../models/Message');
const WidgetSession = require('../models/WidgetSession');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { asString, asEmail, asEnum } = require('../utils/validate');
const {
  parseTwilioConfig,
  parseGmailConfig,
  parseMetaConfig,
} = require('../services/userIntegrationResolver');

const router = express.Router();

function formatAgo(timestamp) {
  if (!timestamp) return 'never';
  const raw = String(timestamp);
  const date = raw.includes('T')
    ? new Date(raw)
    : new Date(raw.replace(' ', 'T') + 'Z');
  if (Number.isNaN(date.getTime())) return 'unknown';

  const diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  return `${Math.floor(diffHours / 24)} day ago`;
}

router.get('/channels/status', requireAuth, async (_req, res) => {
  const user = await User.getById(_req.user.id);
  const webActive = await WidgetSession.countActive();
  const webTotal = await WidgetSession.totalCount();
  const recent = await Message.recentFeed(600, _req.user.id);

  const lastWhatsapp = recent.find((item) => item.channel === 'whatsapp');
  const lastEmail = recent.find((item) => item.channel === 'email');
  const lastInstagram = recent.find((item) => item.channel === 'instagram');
  const lastMessenger = recent.find((item) => item.channel === 'messenger');
  const lastWeb = recent.find((item) => item.channel === 'web' || item.channel === 'webchat');

  const twilioConfig = parseTwilioConfig(user?.twilioKey);
  const gmailConfig = parseGmailConfig(user?.gmailConfig);
  const metaConfig = parseMetaConfig(user?.metaConfig);

  res.json({
    whatsapp: {
      configured: twilioService.isConfigured(twilioConfig) || Boolean(twilioConfig?.whatsappNumber || user?.twilioKey),
      number: twilioConfig?.whatsappNumber || process.env.TWILIO_WHATSAPP_NUMBER || null,
      lastMessage: lastWhatsapp ? formatAgo(lastWhatsapp.timestamp) : 'never',
    },
    email: {
      configured: emailService.isConfigured(gmailConfig) || Boolean(gmailConfig?.smtpUser || user?.gmailConfig),
      address: gmailConfig?.smtpUser || process.env.GMAIL_USER || user?.email || null,
      lastMessage: lastEmail ? formatAgo(lastEmail.timestamp) : 'never',
    },
    web: {
      configured: true,
      activeSessions: webActive,
      totalChats: webTotal,
      lastMessage: lastWeb ? formatAgo(lastWeb.timestamp) : 'never',
    },
    instagram: {
      configured: metaService.isConfigured(metaConfig) || Boolean(metaConfig?.accessToken),
      lastMessage: lastInstagram ? formatAgo(lastInstagram.timestamp) : 'never',
      webhookUrl: '/api/webhook/meta',
    },
    messenger: {
      configured: metaService.isConfigured(metaConfig) || Boolean(metaConfig?.accessToken),
      lastMessage: lastMessenger ? formatAgo(lastMessenger.timestamp) : 'never',
      webhookUrl: '/api/webhook/meta',
    },
  });
});

router.post('/channels/test/:channel', requireAuth, async (req, res) => {
  try {
    const channel = asEnum(req.params.channel, 'channel', ['whatsapp', 'email', 'web'], { required: true });
    const toRaw = asString(req.body?.to, 'to', { max: 320 });
    const user = await User.getById(req.user.id);
    const twilioConfig = parseTwilioConfig(user?.twilioKey);
    const gmailConfig = parseGmailConfig(user?.gmailConfig);

    if (channel === 'whatsapp') {
      const to = asString(toRaw, 'to', { required: true, min: 7, max: 32 });
      const result = await twilioService.sendWhatsApp(
        to,
        'HireAI test message: WhatsApp integration is active.',
        twilioConfig
      );
      return res.json({ channel, result });
    }

    if (channel === 'email') {
      const to = asEmail(toRaw, 'to', { required: true });
      const result = await emailService.send(
        to,
        'HireAI Test Email',
        'This is a test email from HireAI. Your email channel is connected.',
        'This is a test email from HireAI. Your email channel is connected.',
        {
          agencyName: user?.agencyName || 'HireAI Realty',
          agencyLogo: user?.logoUrl || null,
          smtpUser: gmailConfig?.smtpUser || null,
          smtpPass: gmailConfig?.smtpPass || null,
        }
      );
      return res.json({ channel, result });
    }

    if (channel === 'web') {
      return res.json({
        channel,
        result: { success: true, mocked: true, message: 'Web widget channel is active by default.' },
      });
    }

    return res.status(400).json({ error: 'Unsupported channel' });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to run channel test' });
  }
});

router.post('/channels/disconnect/:channel', requireAuth, async (req, res) => {
  let channel;
  try {
    channel = asEnum(req.params.channel, 'channel', ['whatsapp', 'email', 'web'], { required: true });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Invalid channel' });
  }

  if (channel === 'whatsapp') {
    const updated = await User.updateSettings(req.user.id, { twilioKey: null });
    return res.json({ success: true, settings: updated });
  }

  if (channel === 'email') {
    const updated = await User.updateSettings(req.user.id, { gmailConfig: null });
    return res.json({ success: true, settings: updated });
  }

  if (channel === 'web') {
    return res.json({ success: true, note: 'Web widget cannot be disconnected globally.' });
  }

  return res.status(400).json({ error: 'Unsupported channel' });
});

module.exports = router;
