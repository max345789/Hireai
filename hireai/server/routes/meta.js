/**
 * Meta Webhook Route
 * Handles incoming messages from:
 *   - Facebook Messenger (object: "page")
 *   - Instagram DMs     (object: "instagram")
 */

const express = require('express');
const metaService = require('../services/metaService');
const { processInboundEvent } = require('../services/conversationPipeline');
const Lead = require('../models/Lead');
const Message = require('../models/Message');
const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');
const WebhookEvent = require('../models/WebhookEvent');
const IdempotencyKey = require('../models/IdempotencyKey');
const logger = require('../services/logger');
const {
  findUserByMetaInbound,
  findUserByMetaVerifyToken,
  parseMetaConfig,
} = require('../services/userIntegrationResolver');

const router = express.Router();

function emit(io, event, payload) {
  if (io) io.emit(event, payload);
}

async function resolveDefaultUserId() {
  const user = await User.firstUser();
  return user?.id || null;
}

router.get('/webhook/meta', async (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const result = metaService.verifyWebhook(mode, token, challenge);

  if (result.ok) {
    logger.info('meta_webhook_verified', { mode });
    return res.status(200).send(result.challenge);
  }

  try {
    const user = await findUserByMetaVerifyToken(token);
    if (!user) {
      logger.warn('meta_webhook_verification_failed', { mode, token });
      return res.status(403).send('Forbidden');
    }

    const cfg = parseMetaConfig(user.metaConfig);
    const scoped = metaService.verifyWebhook(mode, token, challenge, {
      verifyToken: cfg.verifyToken,
    });

    if (!scoped.ok) {
      logger.warn('meta_webhook_verification_failed', { mode, token, userId: user.id });
      return res.status(403).send('Forbidden');
    }

    logger.info('meta_webhook_verified_user_token', { mode, userId: user.id });
    return res.status(200).send(scoped.challenge);
  } catch {
    return res.status(403).send('Forbidden');
  }
});

router.post('/webhook/meta', async (req, res) => {
  res.status(200).json({ received: true });

  const io = req.app.get('io');
  const parsed = metaService.parseIncoming(req.body || {});

  if (!parsed.length) return;

  setImmediate(async () => {
    for (const msg of parsed) {
      if (!msg.senderId) continue;
      const matchedUser = await findUserByMetaInbound({ pageId: msg.pageId });
      const defaultUserId = matchedUser?.id || await resolveDefaultUserId();

      const eventKey = (msg.mid || `${msg.channel}:${msg.senderId}:${msg.text || 'attachment'}`).slice(0, 200);

      const reservation = await IdempotencyKey.reserve(`webhook:${msg.channel}`, eventKey, eventKey, 72);

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
        const pseudoPhone = `${msg.channel}:${msg.senderId}`;
        let lead = await Lead.findByContact({ phone: pseudoPhone, email: null, channel: msg.channel, userId: defaultUserId });

        if (!lead) {
          const channelLabel = msg.channel === 'instagram' ? 'Instagram' : 'Messenger';
          lead = await Lead.create({
            userId: defaultUserId,
            name: `${channelLabel} Lead`,
            phone: pseudoPhone,
            email: null,
            channel: msg.channel,
            status: 'new',
            sentiment: 'neutral',
          });

          emit(io, 'lead:updated', lead);

          const newActivity = await ActivityLog.create({
            leadId: lead.id,
            userId: lead.userId || defaultUserId || null,
            leadName: lead.name,
            action: 'replied',
            channel: msg.channel,
            description: `New lead via ${channelLabel}`,
            sentByAI: true,
          });
          emit(io, 'agent:action', newActivity);
        }

        if (lead && !lead.userId && defaultUserId) {
          lead = await Lead.update(lead.id, { userId: defaultUserId });
        }

        if (!msg.text) {
          const inMessage = await Message.create({
            leadId: lead.id,
            direction: 'in',
            channel: msg.channel,
            content: `[${msg.channel} media received — review manually]`,
            sentByAI: false,
            draftState: 'received',
            externalSid: msg.mid,
            deliveryStatus: 'received',
            metadata: { source: 'webhook_meta', attachments: msg.attachments || [] },
          });

          emit(io, 'message:new', { ...inMessage, leadName: lead.name, leadStatus: lead.status });

          const activity = await ActivityLog.create({
            leadId: lead.id,
            userId: lead.userId || defaultUserId || null,
            leadName: lead.name,
            action: 'needs_human',
            channel: msg.channel,
            description: `Media attachment from ${lead.name} on ${msg.channel}`,
            sentByAI: false,
          });
          emit(io, 'agent:action', activity);
          emit(io, 'agent:escalated', {
            leadId: lead.id,
            leadName: lead.name,
            reason: 'Media attachment requires manual handling',
            channel: msg.channel,
          });

          await WebhookEvent.markProcessed(event.id);
          await IdempotencyKey.complete(reservation.row.id, 200, JSON.stringify({ ok: true }));
          continue;
        }

        await processInboundEvent({
          io,
          lead,
          userId: lead.userId || defaultUserId,
          channel: msg.channel,
          message: msg.text,
          externalSid: msg.mid,
          metadata: { source: 'webhook_meta' },
        });

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
