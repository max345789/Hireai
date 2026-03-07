const { env } = require('../config/env');

const LEVEL_ORDER = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function shouldLog(level) {
  const configured = LEVEL_ORDER[env.logLevel] || LEVEL_ORDER.info;
  const current = LEVEL_ORDER[level] || LEVEL_ORDER.info;
  return current >= configured;
}

function redactString(value) {
  if (typeof value !== 'string') return value;

  return value
    .replace(/([\w.%+-]+)@([\w.-]+\.[A-Za-z]{2,})/g, '[redacted_email]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[redacted_phone]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted_token]');
}

function sanitizeObject(input, depth = 0) {
  if (input == null) return input;
  if (depth > 5) return '[max_depth_reached]';

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeObject(item, depth + 1));
  }

  if (typeof input === 'object') {
    const out = {};
    for (const [key, value] of Object.entries(input)) {
      if (/password|token|secret|authorization|api[-_]?key|auth/i.test(key)) {
        out[key] = '[redacted]';
      } else {
        out[key] = sanitizeObject(value, depth + 1);
      }
    }
    return out;
  }

  if (typeof input === 'string') {
    return redactString(input);
  }

  return input;
}

function log(level, message, context = {}) {
  if (!shouldLog(level)) return;

  const payload = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...sanitizeObject(context),
  };

  const line = JSON.stringify(payload);
  if (level === 'error') {
    // eslint-disable-next-line no-console
    console.error(line);
    return;
  }

  if (level === 'warn') {
    // eslint-disable-next-line no-console
    console.warn(line);
    return;
  }

  // eslint-disable-next-line no-console
  console.log(line);
}

module.exports = {
  debug: (message, context) => log('debug', message, context),
  info: (message, context) => log('info', message, context),
  warn: (message, context) => log('warn', message, context),
  error: (message, context) => log('error', message, context),
  sanitizeObject,
};
