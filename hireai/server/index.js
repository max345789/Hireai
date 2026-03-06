require('dotenv').config();

const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const cron = require('node-cron');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

const { initDb, getDb } = require('./db');
const { env, startupConfigChecks } = require('./config/env');
const { requestContext } = require('./middleware/requestContext');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const logger = require('./services/logger');

const User = require('./models/User');
const Message = require('./models/Message');
const IdempotencyKey = require('./models/IdempotencyKey');
const { processMessage } = require('./services/agentBrain');

const authRoutes = require('./routes/auth');
const leadsRoutes = require('./routes/leads');
const messagesRoutes = require('./routes/messages');
const webhooksRoutes = require('./routes/webhooks');
const widgetRoutes = require('./routes/widget');
const channelsRoutes = require('./routes/channels');
const analyticsRoutes = require('./routes/analytics');
const agentRoutes = require('./routes/agent');
const bookingRoutes = require('./routes/bookings');
const billingRoutes = require('./routes/billing');
const calendarRoutes = require('./routes/calendar');
const { runAllSweeps } = require('./services/followupEngine');

const app = express();
const server = http.createServer(app);

let dbReady = false;

function isOriginAllowed(origin) {
  if (!origin) {
    return true;
  }

  if (!env.corsOrigins.length) {
    return !env.isProd;
  }

  return env.corsOrigins.includes(origin);
}

const ioCorsOrigin = env.corsOrigins.length ? env.corsOrigins : (env.isProd ? false : true);

const io = new Server(server, {
  cors: {
    origin: ioCorsOrigin,
    credentials: true,
  },
});

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
app.use(express.static(path.join(__dirname, '..', 'client', 'public')));

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

const webhookLimiter = limiter('webhooks', env.webhookRateWindowMs, env.webhookRateMax);
const widgetLimiter = limiter('widget', env.widgetRateWindowMs, env.widgetRateMax);
const authLimiter = limiter('auth', env.authRateWindowMs, env.authRateMax);

app.use('/api/webhook', webhookLimiter);
app.use('/api/widget', widgetLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

io.on('connection', (socket) => {
  socket.emit('system:connected', { connectedAt: new Date().toISOString() });
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'hireai-server',
    env: env.nodeEnv,
    uptimeSec: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    dbReady,
  });
});

app.get('/api/ready', async (_req, res) => {
  if (!dbReady) {
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
app.use('/api', analyticsRoutes);
app.use('/api', agentRoutes);
app.use('/api', bookingRoutes);
app.use('/api', billingRoutes);
app.use('/api', calendarRoutes);

app.use(notFound);
app.use(errorHandler);

function connectionStatus() {
  const claudeConnected = Boolean(process.env.ANTHROPIC_API_KEY);
  const twilioConnected = Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_NUMBER
  );
  const gmailConnected = Boolean(process.env.GMAIL_USER && (process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASSWORD));

  return {
    claudeConnected,
    twilioConnected,
    gmailConnected,
  };
}

function printStartupBanner() {
  const status = connectionStatus();

  // eslint-disable-next-line no-console
  console.log('🚀 HireAI Server Running');
  // eslint-disable-next-line no-console
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━');
  // eslint-disable-next-line no-console
  console.log(`${status.claudeConnected ? '✅' : '⚠️ '} Claude API: ${status.claudeConnected ? 'Connected' : 'Not configured (fallback mode)'}`);
  // eslint-disable-next-line no-console
  console.log('✅ Database: Ready');
  // eslint-disable-next-line no-console
  console.log('✅ Socket.io: Active');
  // eslint-disable-next-line no-console
  console.log(`${status.twilioConnected ? '✅' : '⚠️ '} Twilio: ${status.twilioConnected ? 'Configured' : 'Not configured (simulation mode)'}`);
  // eslint-disable-next-line no-console
  console.log(`${status.gmailConnected ? '✅' : '⚠️ '} Gmail: ${status.gmailConnected ? 'Configured' : 'Not configured'}`);
  // eslint-disable-next-line no-console
  console.log(`${process.env.RAZORPAY_KEY_ID ? '✅' : '⚠️ '} Razorpay: ${process.env.RAZORPAY_KEY_ID ? 'Configured' : 'Not configured'}`);
  // eslint-disable-next-line no-console
  console.log(`${process.env.GOOGLE_CLIENT_ID ? '✅' : '⚠️ '} Google Calendar: ${process.env.GOOGLE_CLIENT_ID ? 'Configured' : 'Not configured'}`);
  // eslint-disable-next-line no-console
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━');
  // eslint-disable-next-line no-console
  console.log('🤖 Agent Status: ACTIVE');
  // eslint-disable-next-line no-console
  console.log('📨 Simulation Mode: ON');
  // eslint-disable-next-line no-console
  console.log('📅 Follow-up Engine: ACTIVE (every 30 min)');
}

async function ensureDefaultUser() {
  const user = await User.firstUser();
  if (user) return;

  const password = await bcrypt.hash('password123', 10);
  await User.create({
    agencyName: 'HireAI Demo Realty',
    email: 'admin@hireai.local',
    password,
    agentPersonality: 'Warm, proactive, and concise',
  });

  logger.warn('created_default_user', {
    email: 'admin@hireai.local',
    note: 'Update this credential immediately in non-demo environments.',
  });
}

async function runFollowupSweep() {
  const db = await getDb();
  const leads = await db.all(
    `SELECT l.*
     FROM leads l
     JOIN messages m ON m.id = (
       SELECT id FROM messages WHERE leadId = l.id ORDER BY timestamp DESC, id DESC LIMIT 1
     )
     WHERE l.aiPaused = 0
       AND l.status IN ('new', 'qualified')
       AND m.direction = 'in'
       AND datetime(m.timestamp) <= datetime('now', '-24 hours')
     LIMIT 20`
  );

  for (const lead of leads) {
    const history = await Message.getByLeadId(lead.id);
    await processMessage('Please follow up with this lead after inactivity.', lead, history.slice(-10), {
      io,
      channel: lead.channel,
    });
  }
}

function scheduleJobs() {
  cron.schedule('0 * * * *', async () => {
    try {
      await runFollowupSweep();
    } catch (error) {
      logger.error('legacy_followup_sweep_failed', { error: error.message });
    }
  });

  cron.schedule('*/30 * * * *', async () => {
    try {
      await runAllSweeps(io);
      logger.info('followup_sweep_complete');
    } catch (error) {
      logger.error('followup_sweep_failed', { error: error.message });
    }
  });

  cron.schedule('0 */6 * * *', async () => {
    try {
      const deleted = await IdempotencyKey.deleteExpired();
      logger.info('idempotency_cleanup_complete', { deleted });
    } catch (error) {
      logger.error('idempotency_cleanup_failed', { error: error.message });
    }
  });
}

function validateStartupConfig() {
  const checks = startupConfigChecks();
  let fatal = false;

  for (const check of checks) {
    if (check.level === 'error') {
      fatal = true;
      logger.error('startup_config_error', { message: check.message });
    } else {
      logger.warn('startup_config_warning', { message: check.message });
    }
  }

  if (fatal) {
    throw new Error('Startup config validation failed');
  }
}

async function start() {
  validateStartupConfig();
  await initDb();
  dbReady = true;
  await ensureDefaultUser();
  scheduleJobs();

  server.listen(env.port, () => {
    printStartupBanner();
    logger.info('server_started', {
      port: env.port,
      apiUrl: `http://localhost:${env.port}`,
      widgetUrl: `http://localhost:${env.port}/widget.js`,
      corsOrigins: env.corsOrigins,
    });
  });
}

process.on('unhandledRejection', (reason) => {
  logger.error('unhandled_rejection', {
    error: reason instanceof Error ? reason.message : String(reason),
  });
});

process.on('uncaughtException', (error) => {
  logger.error('uncaught_exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

start().catch((error) => {
  logger.error('failed_to_start_server', { error: error.message, stack: error.stack });
  process.exit(1);
});
