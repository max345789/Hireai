const Lead = require('../models/Lead');
const Message = require('../models/Message');
const Booking = require('../models/Booking');
const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');
const twilioService = require('./twilioService');
const emailService = require('./emailService');
const metaService = require('./metaService');
const { validateInbound } = require('./channelGuard');
const { runOrchestrator, runAnalyst, runResponder } = require('./aiRoleService');
const { evaluateGuardrails } = require('./guardrailService');
const {
  getTwilioDeliveryConfig,
  getEmailDeliveryConfig,
  getMetaDeliveryConfig,
} = require('./userIntegrationResolver');

const ACTION_TO_ACTIVITY = {
  reply: 'replied',
  qualify: 'qualified',
  book_viewing: 'booked',
  escalate: 'escalated',
  followup: 'followed_up',
  close: 'closed',
};

function emit(io, event, payload) {
  if (io) io.emit(event, payload);
}

function buildBookingDate(preferredDate, preferredTime) {
  if (preferredDate && preferredTime) {
    const composed = new Date(`${preferredDate} ${preferredTime}`);
    if (!Number.isNaN(composed.getTime())) return composed.toISOString();
  }

  if (preferredDate) {
    const dateOnly = new Date(preferredDate);
    if (!Number.isNaN(dateOnly.getTime())) {
      dateOnly.setHours(15, 0, 0, 0);
      return dateOnly.toISOString();
    }
  }

  const fallback = new Date(Date.now() + 24 * 60 * 60 * 1000);
  fallback.setHours(15, 0, 0, 0);
  return fallback.toISOString();
}

async function resolveUser(userId, lead) {
  if (userId) {
    const user = await User.getById(userId);
    if (user) return user;
  }

  if (lead?.userId) {
    const user = await User.getById(lead.userId);
    if (user) return user;
  }

  return null;
}

async function dispatchOutbound(channel, lead, content, user) {
  if (!content) return { success: true, mocked: true };
  const twilioConfig = getTwilioDeliveryConfig(user) || {};
  const emailConfig = getEmailDeliveryConfig(user) || {};
  const metaConfig = getMetaDeliveryConfig(user) || {};

  if (channel === 'whatsapp' && lead.phone) {
    return twilioService.sendWhatsApp(lead.phone, content, twilioConfig);
  }

  if (channel === 'sms' && lead.phone) {
    return twilioService.sendSMS(lead.phone, content, twilioConfig);
  }

  if (channel === 'email' && lead.email) {
    return emailService.send(
      lead.email,
      'Re: Your Property Inquiry',
      content,
      content,
      {
        agencyName: user?.agencyName || 'DAB AI',
        agencyLogo: user?.logoUrl || null,
        ...emailConfig,
      }
    );
  }

  if ((channel === 'instagram' || channel === 'messenger') && lead.phone) {
    const recipientId = String(lead.phone).includes(':')
      ? String(lead.phone).split(':').slice(1).join(':')
      : String(lead.phone);
    return metaService.sendMessage(recipientId, content, metaConfig);
  }

  if (channel === 'web' || channel === 'webchat' || channel === 'manual') {
    return { success: true, mocked: true, sid: null, channel: 'web' };
  }

  return { success: true, mocked: true, sid: null, channel };
}

async function upsertInboundMessage({ lead, channel, content, externalSid = null, metadata = null }) {
  return Message.create({
    leadId: lead.id,
    direction: 'in',
    channel,
    content,
    sentByAI: false,
    draftState: 'received',
    externalSid,
    deliveryStatus: 'received',
    metadata,
  });
}

function mapActionToStatus(orchestratorAction, fallbackStatus = 'new') {
  const map = {
    reply: 'new',
    qualify: 'qualified',
    book_viewing: 'booked',
    escalate: 'escalated',
    followup: 'qualified',
    close: 'closed',
  };

  return map[orchestratorAction] || fallbackStatus;
}

function appendStageHistory(current, nextStatus) {
  const base = Array.isArray(current) ? current : [];
  if (!nextStatus) return base;

  return [
    ...base,
    {
      status: nextStatus,
      at: new Date().toISOString(),
    },
  ].slice(-30);
}

async function processInboundEvent({
  io,
  lead,
  userId = null,
  channel,
  message,
  externalSid = null,
  metadata = null,
}) {
  const user = await resolveUser(userId, lead);

  if (!lead.userId && user?.id) {
    lead = await Lead.update(lead.id, { userId: user.id });
  }

  const guard = await validateInbound({
    lead,
    phone: lead.phone,
    content: message,
  });

  if (!guard.ok) {
    const activity = await ActivityLog.create({
      leadId: lead.id,
      leadName: lead.name,
      action: ['duplicate', 'rate_limited', 'opt_out', 'opt_in_ack'].includes(guard.reason) ? 'replied' : 'needs_human',
      channel,
      description: `Inbound blocked (${guard.reason}) for ${lead.name}`,
      sentByAI: false,
    });

    emit(io, 'agent:action', activity);

    if (!['duplicate', 'rate_limited', 'opt_out', 'opt_in_ack'].includes(guard.reason)) {
      emit(io, 'agent:escalated', {
        leadId: lead.id,
        leadName: lead.name,
        reason: `Inbound blocked: ${guard.reason}`,
        channel,
      });
    }

    return { blocked: true, reason: guard.reason, lead, activity };
  }

  let inMessage = await upsertInboundMessage({
    lead,
    channel,
    content: message,
    externalSid,
    metadata,
  });

  emit(io, 'message:new', {
    ...inMessage,
    leadName: lead.name,
    leadStatus: lead.status,
    icon: '👤',
  });

  const context = {
    lead,
    currentMessage: message,
    channel,
    agencyName: user?.agencyName || 'DAB AI',
  };

  const analyst = await runAnalyst(context);
  const orchestrator = await runOrchestrator({ ...context, analyst });

  const nextStatus = orchestrator.status || mapActionToStatus(orchestrator.action, lead.status);
  const updatedLead = await Lead.update(lead.id, {
    status: nextStatus,
    budget: analyst.budget ?? lead.budget,
    timeline: analyst.timeline ?? lead.timeline,
    propertyType: analyst.propertyType ?? lead.propertyType,
    location: analyst.location ?? lead.location,
    sentiment: analyst.sentiment ?? lead.sentiment,
    intent: analyst.intent,
    urgency: analyst.urgency,
    responseSlaMinutes: analyst.responseSlaMinutes,
    stageHistory: appendStageHistory(lead.stageHistory, nextStatus),
    intelligenceSnapshot: analyst,
  });

  emit(io, 'lead:updated', updatedLead);
  if (updatedLead.status !== lead.status) {
    emit(io, 'lead:moved', {
      leadId: updatedLead.id,
      lead: updatedLead,
      from: lead.status,
      to: updatedLead.status,
    });
  }

  inMessage = await Message.updateDraft(inMessage.id, {
    confidence: orchestrator.confidence,
    riskFlags: orchestrator.riskFlags,
    orchestratorDecision: orchestrator,
    intelligenceSnapshot: analyst,
    draftState: 'received',
  });

  let booking = null;
  if (orchestrator.action === 'book_viewing' || orchestrator.bookingDetails?.requested) {
    booking = await Booking.create({
      leadId: updatedLead.id,
      dateTime: buildBookingDate(orchestrator.bookingDetails?.preferredDate, orchestrator.bookingDetails?.preferredTime),
      property: 'Viewing requested',
      status: 'scheduled',
      notes: `Auto-detected booking intent from ${channel}`,
      clientEmail: updatedLead.email,
      clientPhone: updatedLead.phone,
    });

    emit(io, 'booking:created', {
      ...booking,
      leadName: updatedLead.name,
      leadChannel: updatedLead.channel,
    });
  }

  let outMessage = null;
  let sendResult = null;

  if (orchestrator.shouldRespond !== false) {
    const responseText = await runResponder({
      ...context,
      lead: updatedLead,
      analyst,
      orchestrator,
    });

    const decision = evaluateGuardrails({
      confidence: orchestrator.confidence,
      riskFlags: orchestrator.riskFlags,
      requiresHuman: orchestrator.requiresHuman,
      profanity: Boolean(guard.profanity),
      leadPaused: Boolean(updatedLead.aiPaused),
    });

    const pendingReview = !decision.autoSend;

    outMessage = await Message.create({
      leadId: updatedLead.id,
      direction: 'out',
      channel,
      content: responseText,
      sentByAI: true,
      draftState: pendingReview ? 'pending_approval' : 'sending',
      confidence: orchestrator.confidence,
      riskFlags: [...(orchestrator.riskFlags || []), ...decision.reasons],
      orchestratorDecision: orchestrator,
      intelligenceSnapshot: analyst,
      deliveryStatus: pendingReview ? 'draft' : 'queued',
      metadata: {
        source: 'conversation_pipeline',
        reasoning: orchestrator.reasoning,
      },
    });

    if (pendingReview) {
      sendResult = {
        queuedForApproval: true,
        reasons: decision.reasons,
      };

      const reviewActivity = await ActivityLog.create({
        leadId: updatedLead.id,
        leadName: updatedLead.name,
        action: 'needs_human',
        channel,
        description: `Draft queued for approval: ${decision.reasons.join(', ') || 'manual review required'}`,
        sentByAI: true,
      });

      emit(io, 'agent:action', reviewActivity);
      emit(io, 'message:sent', {
        ...outMessage,
        leadName: updatedLead.name,
        leadStatus: updatedLead.status,
        icon: '📝',
      });
    } else {
      sendResult = await dispatchOutbound(channel, updatedLead, responseText, user);

      outMessage = await Message.updateDelivery(outMessage.id, {
        externalSid: sendResult?.sid || null,
        deliveryStatus: sendResult?.success === false ? 'failed' : 'sent',
        error: sendResult?.error || null,
        draftState: sendResult?.success === false ? 'failed' : 'sent',
      });

      if (sendResult?.success === false) {
        const failActivity = await ActivityLog.create({
          leadId: updatedLead.id,
          leadName: updatedLead.name,
          action: 'needs_human',
          channel,
          description: `Delivery failed for AI message: ${sendResult.error || 'unknown error'}`,
          sentByAI: true,
        });

        emit(io, 'agent:action', failActivity);
        emit(io, 'agent:escalated', {
          leadId: updatedLead.id,
          leadName: updatedLead.name,
          reason: sendResult.error || 'Delivery failed',
          channel,
        });
      }

      emit(io, 'message:sent', {
        ...outMessage,
        leadName: updatedLead.name,
        leadStatus: updatedLead.status,
        icon: sendResult?.success === false ? '⚠️' : '🤖',
      });
    }
  }

  const activity = await ActivityLog.create({
    leadId: updatedLead.id,
    leadName: updatedLead.name,
    action: ACTION_TO_ACTIVITY[orchestrator.action] || 'replied',
    channel,
    description: orchestrator.reasoning || `Processed inbound ${channel} message`,
    sentByAI: true,
  });

  emit(io, 'agent:action', activity);

  if (orchestrator.action === 'escalate' || updatedLead.status === 'escalated') {
    emit(io, 'agent:escalated', {
      leadId: updatedLead.id,
      leadName: updatedLead.name,
      reason: orchestrator.reasoning || 'Escalated by orchestrator',
      channel,
    });
  }

  return {
    blocked: false,
    lead: updatedLead,
    inMessage,
    outMessage,
    booking,
    activity,
    analyst,
    orchestrator,
    sendResult,
  };
}

module.exports = {
  processInboundEvent,
  dispatchOutbound,
};
