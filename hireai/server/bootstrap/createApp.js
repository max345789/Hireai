const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { env } = require('../config/env');
const { requestContext } = require('../middleware/requestContext');
const { notFound, errorHandler } = require('../middleware/errorHandler');

const authRoutes = require('../routes/auth');
const leadsRoutes = require('../routes/leads');
const messagesRoutes = require('../routes/messages');
const webhooksRoutes = require('../routes/webhooks');
const widgetRoutes = require('../routes/widget');
const channelsRoutes = require('../routes/channels');
const integrationsRoutes = require('../routes/integrations');
const analyticsRoutes = require('../routes/analytics');
const agentRoutes = require('../routes/agent');
const inboxRoutes = require('../routes/inbox');
const bookingRoutes = require('../routes/bookings');
const billingRoutes = require('../routes/billing');
const calendarRoutes = require('../routes/calendar');
const metaRoutes = require('../routes/meta');
const agentSelectorRoutes = require('../routes/agentSelector');

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (!env.corsOrigins.length) return !env.isProd;
  return env.corsOrigins.includes(origin);
}

function limiter(name, windowMs, max) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler(req, res) {
      res.status(429).json({
        error: `Rate limit exceeded for ${name}`,
        requestId: req.requestId,
      });
    },
  });
}

function createApp({ io, getDb, isDbReady }) {
  const app = express();

  app.set('trust proxy', 1);
  app.set('io', io);

  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
      hsts: env.isProd,
    })
  );

  app.use(
    cors({
      origin(origin, callback) {
        if (isOriginAllowed(origin)) {
          callback(null, true);
          return;
        }

        callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id'],
    })
  );

  app.use(express.json({ limit: env.requestBodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: env.requestBodyLimit }));
  app.use(requestContext);
  app.use(express.static(path.join(__dirname, '..', '..', 'client', 'public')));

  app.use('/api/webhook', limiter('webhooks', env.webhookRateWindowMs, env.webhookRateMax));
  app.use('/api/widget', limiter('widget', env.widgetRateWindowMs, env.widgetRateMax));
  app.use('/api/auth/login', limiter('auth', env.authRateWindowMs, env.authRateMax));
  app.use('/api/auth/register', limiter('auth', env.authRateWindowMs, env.authRateMax));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'hireai-server',
      env: env.nodeEnv,
      uptimeSec: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      dbReady: isDbReady(),
    });
  });

  app.get('/api/ready', async (_req, res) => {
    if (!isDbReady()) {
      return res.status(503).json({ ok: false, reason: 'database_not_ready' });
    }

    try {
      const db = await getDb();
      await db.get('SELECT 1 AS ok');
      return res.json({ ok: true });
    } catch (error) {
      return res.status(503).json({ ok: false, reason: error.message });
    }
  });

  app.use('/api', webhooksRoutes);
  app.use('/api', widgetRoutes);
  app.use('/api', authRoutes);
  app.use('/api', leadsRoutes);
  app.use('/api', messagesRoutes);
  app.use('/api', channelsRoutes);
  app.use('/api', integrationsRoutes);
  app.use('/api', analyticsRoutes);
  app.use('/api', agentRoutes);
  app.use('/api', inboxRoutes);
  app.use('/api', bookingRoutes);
  app.use('/api', billingRoutes);
  app.use('/api', calendarRoutes);
  app.use('/api', metaRoutes);
  app.use('/api', agentSelectorRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
