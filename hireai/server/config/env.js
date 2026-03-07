function toInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function toBoolean(value, fallback) {
  if (value == null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function parseOrigins(raw) {
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isPlaceholderSecret(value) {
  if (!value) return false;
  const normalized = String(value).trim().toLowerCase();
  return (
    normalized === 'password123' ||
    normalized.includes('change-this') ||
    normalized.includes('your_') ||
    normalized.includes('example')
  );
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
  allowMockDelivery: toBoolean(process.env.ALLOW_MOCK_DELIVERY, !isProd),
  aiModelChain: process.env.AI_MODEL_CHAIN || 'claude,openai,gemini',
  bootstrapAdminOnStart: toBoolean(process.env.BOOTSTRAP_ADMIN_ON_START, false),
  bootstrapAdminEmail: process.env.ADMIN_EMAIL ? String(process.env.ADMIN_EMAIL).trim().toLowerCase() : null,
  bootstrapAdminPassword: process.env.ADMIN_PASSWORD || null,
  bootstrapAdminAgencyName: process.env.ADMIN_AGENCY_NAME || 'HireAI Realty',
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

    if (env.allowMockDelivery) {
      checks.push({
        level: 'error',
        message: 'ALLOW_MOCK_DELIVERY must be false in production.',
      });
    }

    if (env.bootstrapAdminOnStart) {
      checks.push({
        level: 'error',
        message: 'BOOTSTRAP_ADMIN_ON_START must be false in production.',
      });
    }
  }

  const aiProvidersConfigured = Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY);
  if (!aiProvidersConfigured) {
    checks.push({
      level: 'warn',
      message: 'No cloud AI model key configured (ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY). System will run in resilient fallback mode.',
    });
  }

  if (env.bootstrapAdminOnStart) {
    if (!env.bootstrapAdminEmail || !env.bootstrapAdminPassword) {
      checks.push({
        level: 'warn',
        message: 'Bootstrap admin is enabled but ADMIN_EMAIL or ADMIN_PASSWORD is missing. No bootstrap user will be created.',
      });
    }

    if (env.bootstrapAdminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.bootstrapAdminEmail)) {
      checks.push({
        level: 'error',
        message: 'ADMIN_EMAIL is invalid.',
      });
    }

    if (env.bootstrapAdminPassword && isPlaceholderSecret(env.bootstrapAdminPassword)) {
      checks.push({
        level: 'error',
        message: 'ADMIN_PASSWORD looks like a placeholder. Set a real password before enabling bootstrap admin.',
      });
    }

    if (env.bootstrapAdminPassword && String(env.bootstrapAdminPassword).length < 12) {
      checks.push({
        level: 'warn',
        message: 'ADMIN_PASSWORD is shorter than 12 characters. Use a stronger password.',
      });
    }
  }

  return checks;
}


module.exports = {
  env,
  startupConfigChecks,
};
