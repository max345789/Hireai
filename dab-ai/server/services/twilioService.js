const twilio = require('twilio');
const { env } = require('../config/env');

function resolveCredentials(options = {}) {
  return {
    accountSid: options.accountSid || process.env.TWILIO_ACCOUNT_SID || null,
    authToken: options.authToken || process.env.TWILIO_AUTH_TOKEN || null,
    whatsappNumber: options.whatsappNumber || process.env.TWILIO_WHATSAPP_NUMBER || null,
    smsNumber: options.smsNumber || process.env.TWILIO_SMS_NUMBER || null,
  };
}

function getClient(credentials) {
  const accountSid = credentials?.accountSid || null;
  const authToken = credentials?.authToken || null;
  if (!accountSid || !authToken) return null;
  return twilio(accountSid, authToken);
}

function normalizeWhatsAppNumber(value) {
  if (!value) return null;
  return String(value).startsWith('whatsapp:') ? String(value) : `whatsapp:${value}`;
}

function isConfigured(options = {}) {
  const credentials = resolveCredentials(options);
  return Boolean(credentials.accountSid && credentials.authToken && credentials.whatsappNumber);
}

async function sendWhatsApp(to, message, options = {}) {
  const credentials = resolveCredentials(options);
  const client = getClient(credentials);
  const from = normalizeWhatsAppNumber(credentials.whatsappNumber);
  const body = String(message || '').trim();
  const target = String(to || '').trim();

  if (!target || !body) {
    return {
      mocked: true,
      sid: null,
      channel: 'whatsapp',
      to: target || null,
      body,
      success: false,
      error: 'Missing recipient or message body',
    };
  }

  if (!client || !from) {
    if (!env.allowMockDelivery) {
      return {
        mocked: false,
        sid: null,
        channel: 'whatsapp',
        to: target,
        body,
        success: false,
        error: 'Twilio WhatsApp is not configured',
      };
    }

    return {
      mocked: true,
      sid: null,
      channel: 'whatsapp',
      to: target,
      body,
      success: true,
    };
  }

  try {
    const response = await client.messages.create({
      body: message,
      from,
      to: normalizeWhatsAppNumber(target),
    });

    return {
      mocked: false,
      sid: response.sid,
      channel: 'whatsapp',
      to: target,
      body,
      success: true,
      raw: response,
    };
  } catch (error) {
    return {
      mocked: false,
      sid: null,
      channel: 'whatsapp',
      to: target,
      body,
      success: false,
      error: error.message,
    };
  }
}

async function sendSMS(to, message, options = {}) {
  const credentials = resolveCredentials(options);
  const client = getClient(credentials);
  const from = credentials.smsNumber || credentials.whatsappNumber?.replace('whatsapp:', '');
  const body = String(message || '').trim();
  const target = String(to || '').trim();

  if (!target || !body) {
    return {
      mocked: true,
      sid: null,
      channel: 'sms',
      to: target || null,
      body,
      success: false,
      error: 'Missing recipient or message body',
    };
  }

  if (!client || !from) {
    if (!env.allowMockDelivery) {
      return {
        mocked: false,
        sid: null,
        channel: 'sms',
        to: target,
        body,
        success: false,
        error: 'Twilio SMS is not configured',
      };
    }

    return {
      mocked: true,
      sid: null,
      channel: 'sms',
      to: target,
      body,
      success: true,
    };
  }

  try {
    const response = await client.messages.create({
      body,
      from,
      to: target,
    });

    return {
      mocked: false,
      sid: response.sid,
      channel: 'sms',
      to: target,
      body,
      success: true,
      raw: response,
    };
  } catch (error) {
    return {
      mocked: false,
      sid: null,
      channel: 'sms',
      to: target,
      body,
      success: false,
      error: error.message,
    };
  }
}

function getWebhookUrl(req) {
  const base = process.env.BASE_URL;
  if (base) {
    return `${base}${req.originalUrl}`;
  }

  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${protocol}://${host}${req.originalUrl}`;
}

function validateWebhook(req) {
  if (!isConfigured()) {
    return true;
  }

  const signature = req.headers['x-twilio-signature'];
  if (!signature) {
    return false;
  }

  try {
    return twilio.validateRequest(
      process.env.TWILIO_AUTH_TOKEN,
      signature,
      getWebhookUrl(req),
      req.body
    );
  } catch {
    return false;
  }
}

function parseIncoming(webhookBody) {
  const fromRaw = webhookBody?.From || '';
  const toRaw = webhookBody?.To || '';
  const from = String(fromRaw).replace('whatsapp:', '').trim();
  const to = String(toRaw).replace('whatsapp:', '').trim();
  const mediaContentType = webhookBody?.MediaContentType0 || null;

  let messageType = 'text';
  if (webhookBody?.NumMedia && Number(webhookBody.NumMedia) > 0) {
    if (mediaContentType && mediaContentType.startsWith('image/')) {
      messageType = 'image';
    } else if (mediaContentType && mediaContentType.startsWith('audio/')) {
      messageType = 'audio';
    } else {
      messageType = 'media';
    }
  }

  return {
    from,
    message: webhookBody?.Body || '',
    mediaUrl: webhookBody?.MediaUrl0 || null,
    mediaContentType,
    messageType,
    channel: 'whatsapp',
    twilioSid: webhookBody?.MessageSid || null,
    accountSid: webhookBody?.AccountSid || null,
    to,
    profileName: webhookBody?.ProfileName || null,
  };
}

module.exports = {
  isConfigured,
  sendWhatsApp,
  sendSMS,
  validateWebhook,
  parseIncoming,
  normalizeWhatsAppNumber,
};
