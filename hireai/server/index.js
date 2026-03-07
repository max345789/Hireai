require('dotenv').config();

const http = require('http');
const bcrypt = require('bcryptjs');
const cron = require('node-cron');
const { Server } = require('socket.io');

const { initDb, getDb } = require('./db');
const { env, startupConfigChecks } = require('./config/env');
const logger = require('./services/logger');

const User = require('./models/User');
const Message = require('./models/Message');
const IdempotencyKey = require('./models/IdempotencyKey');
const { processMessage } = require('./services/agentBrain');
const { runAllSweeps } = require('./services/followupEngine');
const { createApp } = require('./bootstrap/createApp');

let dbReady = false;

const ioCorsOrigin = env.corsOrigins.length ? env.corsOrigins : (env.isProd ? false : true);

const app = createApp({
  io: null,
  getDb,
  isDbReady: () => dbReady,
});
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ioCorsOrigin,
    credentials: true,
  },
});
app.set('io', io);

io.on('connection', (socket) => {
  socket.emit('system:connected', { connectedAt: new Date().toISOString() });
});

function connectionStatus() {
  const claudeConnected = Boolean(process.env.ANTHROPIC_API_KEY);
  const twilioConnected = Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_NUMBER
  );
  const gmailConnected = Boolean(process.env.GMAIL_USER && (process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASSWORD));
  const metaConnected = Boolean(process.env.META_PAGE_ACCESS_TOKEN && process.env.META_VERIFY_TOKEN);

  return {
    claudeConnected,
    twilioConnected,
    gmailConnected,
    metaConnected,
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
  console.log(`${status.metaConnected ? '✅' : '⚠️ '} Meta (Instagram/Messenger): ${status.metaConnected ? 'Configured' : 'Not configured (add META_PAGE_ACCESS_TOKEN)'}`);
  // eslint-disable-next-line no-console
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━');
  // eslint-disable-next-line no-console
  console.log('🤖 Agent Status: ACTIVE');
  // eslint-disable-next-line no-console
  console.log(`📨 Simulation Mode: ${env.allowMockDelivery ? 'ON' : 'OFF'}`);
  // eslint-disable-next-line no-console
  console.log('📅 Follow-up Engine: ACTIVE (every 30 min)');
}

async function ensureBootstrapAdmin() {
  if (!env.bootstrapAdminOnStart) return;

  const user = await User.firstUser();
  if (user) return;

  if (!env.bootstrapAdminEmail || !env.bootstrapAdminPassword) {
    logger.warn('bootstrap_admin_skipped', {
      reason: 'missing_admin_email_or_password',
    });
    return;
  }

  const password = await bcrypt.hash(env.bootstrapAdminPassword, 10);
  await User.create({
    agencyName: env.bootstrapAdminAgencyName,
    email: env.bootstrapAdminEmail,
    password,
    agentPersonality: 'Warm, proactive, and concise',
  });

  logger.warn('bootstrap_admin_created', {
    email: env.bootstrapAdminEmail,
    note: 'Disable BOOTSTRAP_ADMIN_ON_START after first login.',
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
  await ensureBootstrapAdmin();
  scheduleJobs();

  server.listen(env.port, () => {
    printStartupBanner();
    logger.info('server_started', {
      port: env.port,
      apiUrl: process.env.BASE_URL || `http://localhost:${env.port}`,
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
