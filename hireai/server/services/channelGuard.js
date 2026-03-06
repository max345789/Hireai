const Lead = require('../models/Lead');
const Message = require('../models/Message');

const PROFANITY_PATTERN = /\b(fuck|shit|bitch|asshole|bastard|idiot|moron|stupid|damn)\b/i;

function parseTimestamp(raw) {
  if (!raw) return null;
  const normalized = String(raw).includes('T')
    ? new Date(String(raw))
    : new Date(String(raw).replace(' ', 'T') + 'Z');

  return Number.isNaN(normalized.getTime()) ? null : normalized;
}

async function isRateLimited(phone) {
  if (!phone) return false;
  const count = await Message.countForPhoneInWindow(phone, 60 * 60 * 1000);
  return count >= 10;
}

async function isDuplicate(leadId, content) {
  if (!leadId || !content) return false;

  const latestInbound = await Message.getLatestInboundByLead(leadId);
  if (!latestInbound) return false;

  if (String(latestInbound.content || '').trim() !== String(content || '').trim()) {
    return false;
  }

  const ts = parseTimestamp(latestInbound.timestamp);
  if (!ts) return false;

  const ageMs = Date.now() - ts.getTime();
  return ageMs <= 30 * 1000;
}

function hasProfanity(content) {
  return PROFANITY_PATTERN.test(String(content || ''));
}

async function validateInbound({ lead, phone, content }) {
  const normalizedPhone = phone ? String(phone).trim() : null;

  if (normalizedPhone && (await Lead.isBlocked(normalizedPhone))) {
    return { ok: false, reason: 'blocked' };
  }

  if (normalizedPhone && (await isRateLimited(normalizedPhone))) {
    return { ok: false, reason: 'rate_limited' };
  }

  if (await isDuplicate(lead?.id, content)) {
    return { ok: false, reason: 'duplicate' };
  }

  if (hasProfanity(content)) {
    return { ok: true, profanity: true };
  }

  return { ok: true, profanity: false };
}

module.exports = {
  validateInbound,
  hasProfanity,
};
