function toInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function parseOrigins(raw) {
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

const env = {
  nodeEnv,
  isProd,
  port: toInt(process.env.PORT, 3001),
  baseUrl: process.env.BASE_URL || null,
  corsOrigins: parseOrigins(process.env.CORS_ORIGINS),
  jwtSecret: process.env.JWT_SECRET || 'hireai-dev-secret',
  jwtAccessTtl: process.env.JWT_ACCESS_TTL || '7d',
  requestBodyLimit: process.env.REQUEST_BODY_LIMIT || '1mb',
  webhookRateWindowMs: toInt(process.env.WEBHOOK_RATE_WINDOW_MS, 15 * 60 * 1000),
  webhookRateMax: toInt(process.env.WEBHOOK_RATE_MAX, 300),
  widgetRateWindowMs: toInt(process.env.WIDGET_RATE_WINDOW_MS, 60 * 1000),
  widgetRateMax: toInt(process.env.WIDGET_RATE_MAX, 80),
  authRateWindowMs: toInt(process.env.AUTH_RATE_WINDOW_MS, 15 * 60 * 1000),
  authRateMax: toInt(process.env.AUTH_RATE_MAX, 40),
  logLevel: process.env.LOG_LEVEL || 'info',
  sanitizeWebhookPayloads: process.env.SANITIZE_WEBHOOK_PAYLOADS !== 'false',
  webhookPayloadMaxChars: toInt(process.env.WEBHOOK_PAYLOAD_MAX_CHARS, 12000),
  backupDir: process.env.BACKUP_DIR || 'server/backups',
};

function startupConfigChecks() {
  const checks = [];

  if (env.isProd) {
    if (!process.env.JWT_SECRET || String(process.env.JWT_SECRET).length < 32) {
      checks.push({
        level: 'error',
        message: 'JWT_SECRET must be set to at least 32 characters in production.',
      });
    }

    if (!env.baseUrl || !/^https:\/\//i.test(env.baseUrl)) {
      checks.push({
        level: 'warn',
        message: 'BASE_URL is missing or non-HTTPS. Webhook signature validation may fail behind proxies.',
      });
    }

    if (!env.corsOrigins.length) {
      checks.push({
        level: 'warn',
        message: 'CORS_ORIGINS is empty in production. Requests will be rejected unless explicitly configured.',
      });
    }
  }

  return checks;
}

module.exports = {
  env,
  startupConfigChecks,
};
