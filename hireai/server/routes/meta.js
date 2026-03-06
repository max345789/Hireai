/**
 * Meta Webhook Route
 * Handles incoming messages from:
 *   - Facebook Messenger (object: "page")
 *   - Instagram DMs     (object: "instagram")
 *
 * Webhook setup in Meta Developer Console:
 *   Callback URL : https://your-domain.com/api/webhook/meta
 *   Verify Token : value of META_VERIFY_TOKEN env var
 *   Subscriptions: messages, messaging_postbacks
 */

const express = require('express');
const metaService = require('../services/metaService');
const { processMessage } = require('../services/agentBrain');
const Lead = require('../models/Lead');
const Message = require('../models/Message');
const ActivityLog = require('../models/ActivityLog');
const WebhookEvent = require('../models/WebhookEvent');
const IdempotencyKey = require('../models/IdempotencyKey');
const logger = require('../services/logger');

const router = express.Router();

function emit(io, event, payload) {
  if (io) io.emit(event, payload);
}

// ── GET /api/webhook/meta ──────────────────────────────────────────────────
// Meta calls this once when you save the webhook URL in the developer console.
router.get('/webhook/meta', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const result = metaService.verifyWebhook(mode, token, challenge);

  if (result.ok) {
    logger.info('meta_webhook_verified', { mode });
    return res.status(200).send(result.challenge);
  }

  logger.warn('meta_webhook_verification_failed', { mode, token });
  return res.status(403).send('Forbidden');
});

// ── POST /api/webhook/meta ─────────────────────────────────────────────────
// All incoming messages from Messenger and Instagram land here.
router.post('/webhook/meta', async (req, res) => {
  // Respond 200 immediately — Meta requires this within 5 seconds.
  res.status(200).json({ received: true });

  const io = req.app.get('io');
  const parsed = metaService.parseIncoming(req.body || {});

  if (!parsed.length) return;

  setImmediate(async () => {
    for (const msg of parsed) {
      if (!msg.senderId) continue;

      // ── Idempotency guard ──────────────────────────────────────────────
      const eventKey = (msg.mid || `${msg.channel}:${msg.senderId}:${msg.text || 'attachment'}`)
        .slice(0, 200);

      const reservation = await IdempotencyKey.reserve(
        `webhook:${msg.channel}`, eventKey, eventKey, 72
      );

      if (!reservation.created && reservation.row?.status !== 'failed') {
        logger.info('duplicate_meta_webhook_ignored', { channel: msg.channel, senderId: msg.senderId });
        continue;
      }
      if (!reservation.created && reservation.row?.status === 'failed') {
        await IdempotencyKey.markProcessing(reservation.row.id);
      }

      const event = await WebhookEvent.create({
        channel: msg.channel,
        eventType: 'incoming',
        payload: msg.raw,
      });

      try {
        // ── Lead lookup / creation ─────────────────────────────────────
        // Store senderId prefixed with channel so it won't collide with real phone numbers.
        const pseudoPhone = `${msg.channel}:${msg.senderId}`;
        let lead = await Lead.findByContact({ phone: pseudoPhone, email: null, channel: msg.channel });

        if (!lead) {
          const channelLabel = msg.channel === 'instagram' ? '📸 Instagram' : '💬 Messenger';
          lead = await Lead.create({
            name:      `${channelLabel} Lead`,
            phone:     pseudoPhone,
            email:     null,
            channel:   msg.channel,
            status:    'new',
            sentiment: 'neutral',
          });

          emit(io, 'lead:updated', lead);

          const newActivity = await ActivityLog.create({
            leadId:   lead.id,
            leadName: lead.name,
            action:   'replied',
            channel:  msg.channel,
            description: `🤖 New lead via ${msg.channel === 'instagram' ? 'Instagram DM' : 'Facebook Messenger'}`,
            sentByAI: true,
          });
          emit(io, 'agent:action', newActivity);
        }

        // ── Non-text attachment ────────────────────────────────────────
        if (!msg.text) {
          const inMessage = await Message.create({
            leadId:         lead.id,
            direction:      'in',
            channel:        msg.channel,
            content:        `[${msg.channel === 'instagram' ? 'Instagram' : 'Messenger'} media received — review manually]`,
            sentByAI:       false,
            externalSid:    msg.mid,
            deliveryStatus: 'received',
          });
          emit(io, 'message:new', { ...inMessage, leadName: lead.name, leadStatus: lead.status });

          const activity = await ActivityLog.create({
            leadId:   lead.id,
            leadName: lead.name,
            action:   'needs_human',
            channel:  msg.channel,
            description: `Media attachment from ${lead.name} on ${msg.channel} — requires manual review`,
            sentByAI: false,
          });
          emit(io, 'agent:action', activity);
          emit(io, 'agent:escalated', {
            leadId:   lead.id,
            leadName: lead.name,
            reason:   'Media attachment requires manual handling',
            channel:  msg.channel,
          });

          await WebhookEvent.markProcessed(event.id);
          await IdempotencyKey.complete(reservation.row.id, 200, JSON.stringify({ ok: true }));
          continue;
        }

        // ── Save inbound text message ──────────────────────────────────
        const inMessage = await Message.create({
          leadId:         lead.id,
          direction:      'in',
          channel:        msg.channel,
          content:        msg.text,
          sentByAI:       false,
          externalSid:    msg.mid,
          deliveryStatus: 'received',
        });
        emit(io, 'message:new', { ...inMessage, leadName: lead.name, leadStatus: lead.status });

        // ── Human takeover active — notify agent ───────────────────────
        if (lead.aiPaused) {
          const activity = await ActivityLog.create({
            leadId:   lead.id,
            leadName: lead.name,
            action:   'needs_human',
            channel:  msg.channel,
            description: `New ${msg.channel} message from ${lead.name} while human takeover is active`,
            sentByAI: false,
          });
          emit(io, 'agent:action', activity);
          emit(io, 'agent:escalated', {
            leadId:   lead.id,
            leadName: lead.name,
            reason:   'Human takeover active',
            channel:  msg.channel,
          });

          await WebhookEvent.markProcessed(event.id);
          await IdempotencyKey.complete(reservation.row.id, 200, JSON.stringify({ ok: true }));
          continue;
        }

        // ── Run AI agent ───────────────────────────────────────────────
        const history = await Message.getByLeadId(lead.id);
        await processMessage(msg.text, lead, history.slice(-10), { io, channel: msg.channel });

        await WebhookEvent.markProcessed(event.id);
        await IdempotencyKey.complete(reservation.row.id, 200, JSON.stringify({ ok: true }));
      } catch (error) {
        await WebhookEvent.markFailed(event.id, error.message);
        await IdempotencyKey.fail(reservation.row.id, 500, JSON.stringify({ error: error.message }));
        logger.error('meta_webhook_processing_error', { error: error.message, channel: msg.channel });
      }
    }
  });
});

module.exports = router;
