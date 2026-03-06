const twilio = require('twilio');

function getClient() {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return null;
  return twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
}

function normalizeWhatsAppNumber(value) {
  if (!value) return null;
  return String(value).startsWith('whatsapp:') ? String(value) : `whatsapp:${value}`;
}

function isConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_WHATSAPP_NUMBER
  );
}

async function sendWhatsApp(to, message) {
  const client = getClient();
  const from = normalizeWhatsAppNumber(process.env.TWILIO_WHATSAPP_NUMBER);
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

async function sendSMS(to, message) {
  const client = getClient();
  const from = process.env.TWILIO_SMS_NUMBER || process.env.TWILIO_WHATSAPP_NUMBER?.replace('whatsapp:', '');
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
  const from = String(fromRaw).replace('whatsapp:', '').trim();
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
