const User = require('../models/User');

function parseJson(raw, fallback = {}) {
  if (!raw) return fallback;
  if (typeof raw === 'object' && raw !== null) return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function normalizePhone(value) {
  if (!value) return null;
  return String(value)
    .replace(/^whatsapp:/i, '')
    .replace(/[\s().-]/g, '')
    .trim();
}

function parseTwilioConfig(raw) {
  if (!raw) return {};
  if (String(raw).trim().startsWith('{')) {
    return parseJson(raw, {});
  }

  return {
    accountSid: null,
    authToken: null,
    whatsappNumber: null,
    smsNumber: null,
    legacyKey: String(raw),
  };
}

function parseGmailConfig(raw) {
  if (!raw) return {};

  if (String(raw).trim().startsWith('{')) {
    return parseJson(raw, {});
  }

  const value = String(raw);
  if (!value.includes('|')) {
    return { smtpUser: value.trim(), smtpPass: null };
  }

  const [smtpUser, ...passParts] = value.split('|');
  return {
    smtpUser: String(smtpUser || '').trim(),
    smtpPass: passParts.join('|').trim() || null,
  };
}

function parseMetaConfig(raw) {
  return parseJson(raw, {});
}

async function findUserByTwilioInbound(payload = {}) {
  const users = await User.all();
  if (!users.length) return null;

  const accountSid = String(payload.accountSid || '').trim();
  const toNumber = normalizePhone(payload.to);

  let best = null;

  for (const user of users) {
    const cfg = parseTwilioConfig(user.twilioKey);
    if (!cfg || Object.keys(cfg).length === 0) continue;

    let score = 0;
    if (accountSid && cfg.accountSid && String(cfg.accountSid).trim() === accountSid) score += 6;
    if (toNumber && normalizePhone(cfg.whatsappNumber) === toNumber) score += 4;
    if (toNumber && normalizePhone(cfg.smsNumber) === toNumber) score += 3;

    if (score > 0 && (!best || score > best.score)) {
      best = { user, score };
    }
  }

  if (best) return best.user;

  const configured = users.filter((item) => item.twilioKey);
  if (configured.length === 1) return configured[0];

  return null;
}

function normalizeEmail(value) {
  if (!value) return null;
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/^.*</, '')
    .replace(/>.*$/, '');
}

async function findUserByEmailInbound(payload = {}) {
  const users = await User.all();
  if (!users.length) return null;

  const recipient = normalizeEmail(payload.to);

  if (recipient) {
    for (const user of users) {
      const cfg = parseGmailConfig(user.gmailConfig);
      const candidates = [
        normalizeEmail(cfg.smtpUser),
        normalizeEmail(cfg.user),
        normalizeEmail(user.email),
      ].filter(Boolean);

      if (candidates.includes(recipient)) {
        return user;
      }
    }
  }

  const configured = users.filter((item) => item.gmailConfig);
  if (configured.length === 1) return configured[0];

  return null;
}

async function findUserByMetaInbound(payload = {}) {
  const users = await User.all();
  if (!users.length) return null;

  const pageId = String(payload.pageId || '').trim();

  let best = null;
  for (const user of users) {
    const cfg = parseMetaConfig(user.metaConfig);
    if (!cfg || Object.keys(cfg).length === 0) continue;

    let score = 0;
    if (pageId && cfg.pageId && String(cfg.pageId).trim() === pageId) score += 6;
    if (payload.verifyToken && cfg.verifyToken && String(cfg.verifyToken) === String(payload.verifyToken)) score += 4;

    if (score > 0 && (!best || score > best.score)) {
      best = { user, score };
    }
  }

  if (best) return best.user;

  const configured = users.filter((item) => {
    const cfg = parseMetaConfig(item.metaConfig);
    return Boolean(cfg.accessToken);
  });

  if (configured.length === 1) return configured[0];

  return null;
}

async function findUserByMetaVerifyToken(verifyToken) {
  if (!verifyToken) return null;
  const users = await User.all();

  return users.find((item) => {
    const cfg = parseMetaConfig(item.metaConfig);
    return cfg.verifyToken && String(cfg.verifyToken) === String(verifyToken);
  }) || null;
}

async function resolveWidgetUserByWidgetId(widgetId) {
  if (!widgetId) return null;
  return User.findByWidgetId(String(widgetId).trim());
}

async function resolveWidgetUser({ agencyId, agencyName } = {}) {
  const normalizedAgencyId = String(agencyId || '').trim();
  const normalizedAgencyName = String(agencyName || '').trim();

  if (normalizedAgencyId) {
    if (/^\d+$/.test(normalizedAgencyId)) {
      const byId = await User.getById(Number(normalizedAgencyId));
      if (byId) return byId;
    }

    if (normalizedAgencyId.includes('@')) {
      const byEmail = await User.findByEmail(normalizedAgencyId.toLowerCase());
      if (byEmail) return byEmail;
    }

    const byAgencyIdName = await User.findByAgencyName(normalizedAgencyId);
    if (byAgencyIdName) return byAgencyIdName;
  }

  if (normalizedAgencyName) {
    const byAgencyName = await User.findByAgencyName(normalizedAgencyName);
    if (byAgencyName) return byAgencyName;
  }

  return null;
}

function getTwilioDeliveryConfig(user) {
  if (!user) return null;
  const cfg = parseTwilioConfig(user.twilioKey);
  if (!cfg || Object.keys(cfg).length === 0) return null;

  return {
    accountSid: cfg.accountSid || null,
    authToken: cfg.authToken || null,
    whatsappNumber: cfg.whatsappNumber || null,
    smsNumber: cfg.smsNumber || null,
  };
}

function getEmailDeliveryConfig(user) {
  if (!user) return null;
  const cfg = parseGmailConfig(user.gmailConfig);
  if (!cfg || Object.keys(cfg).length === 0) return null;

  return {
    smtpUser: cfg.smtpUser || cfg.user || null,
    smtpPass: cfg.smtpPass || cfg.pass || null,
  };
}

function getMetaDeliveryConfig(user) {
  if (!user) return null;
  const cfg = parseMetaConfig(user.metaConfig);
  if (!cfg || Object.keys(cfg).length === 0) return null;

  return {
    accessToken: cfg.accessToken || null,
    verifyToken: cfg.verifyToken || null,
    pageId: cfg.pageId || null,
  };
}

module.exports = {
  parseTwilioConfig,
  parseGmailConfig,
  parseMetaConfig,
  findUserByTwilioInbound,
  findUserByEmailInbound,
  findUserByMetaInbound,
  findUserByMetaVerifyToken,
  resolveWidgetUser,
  resolveWidgetUserByWidgetId,
  getTwilioDeliveryConfig,
  getEmailDeliveryConfig,
  getMetaDeliveryConfig,
};
