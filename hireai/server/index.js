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
const User = require('./models/User');
const Message = require('./models/Message');
const Lead = require('./models/Lead');
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
const { runAllSweeps } = require('./services/followupEngine');

const PORT = Number(process.env.PORT || 3001);

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    credentials: true,
  },
});

app.set('io', io);

app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
  })
);

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'client', 'public')));

const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});

const widgetLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/webhook', webhookLimiter);
app.use('/api/widget', widgetLimiter);

io.on('connection', (socket) => {
  socket.emit('system:connected', { connectedAt: new Date().toISOString() });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'hireai-server' });
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

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

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

  console.log('🚀 HireAI Server Running');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`${status.claudeConnected ? '✅' : '⚠️ '} Claude API: ${status.claudeConnected ? 'Connected' : 'Not configured (fallback mode)'}`);
  console.log('✅ Database: Ready');
  console.log('✅ Socket.io: Active');
  console.log(`${status.twilioConnected ? '✅' : '⚠️ '} Twilio: ${status.twilioConnected ? 'Configured' : 'Not configured (simulation mode)'}`);
  console.log(`${status.gmailConnected ? '✅' : '⚠️ '} Gmail: ${status.gmailConnected ? 'Configured' : 'Not configured'}`);
  console.log(`${process.env.RAZORPAY_KEY_ID ? '✅' : '⚠️ '} Razorpay: ${process.env.RAZORPAY_KEY_ID ? 'Configured' : 'Not configured'}`);
  console.log(`${process.env.GOOGLE_CLIENT_ID ? '✅' : '⚠️ '} Google Calendar: ${process.env.GOOGLE_CLIENT_ID ? 'Configured' : 'Not configured'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🤖 Agent Status: ACTIVE');
  console.log('📨 Simulation Mode: ON');
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

  console.log('Created default user: admin@hireai.local / password123');
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
  // Legacy sweep (kept for safety)
  cron.schedule('0 * * * *', async () => {
    try {
      await runFollowupSweep();
    } catch (error) {
      console.error('Follow-up sweep failed:', error.message);
    }
  });

  // Full follow-up engine — runs every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    try {
      await runAllSweeps(io);
      console.log('[FollowupEngine] Sweep complete');
    } catch (error) {
      console.error('[FollowupEngine] Sweep failed:', error.message);
    }
  });
}

async function start() {
  await initDb();
  await ensureDefaultUser();
  scheduleJobs();

  server.listen(PORT, () => {
    printStartupBanner();
    console.log(`🌐 API URL: http://localhost:${PORT}`);
    console.log(`🧩 Widget URL: http://localhost:${PORT}/widget.js`);
  });
}

start().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
