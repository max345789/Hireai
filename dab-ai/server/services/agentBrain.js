const Lead = require('../models/Lead');
const Message = require('../models/Message');
const Booking = require('../models/Booking');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { getAgentDecision } = require('./claudeService');
const twilioService = require('./twilioService');
const emailService = require('./emailService');
const metaService = require('./metaService');

const ACTION_TO_ACTIVITY = {
  reply: 'replied',
  qualify: 'qualified',
  book_viewing: 'booked',
  escalate: 'escalated',
  followup: 'followed_up',
  close: 'closed',
};

const ACTION_TO_STATUS = {
  reply: 'new',
  qualify: 'qualified',
  book_viewing: 'booked',
  escalate: 'escalated',
  followup: 'qualified',
  close: 'closed',
};

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function safeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseTimestamp(raw) {
  if (!raw) return null;

  const normalized = String(raw).includes('T')
    ? new Date(String(raw))
    : new Date(String(raw).replace(' ', 'T') + 'Z');

  return Number.isNaN(normalized.getTime()) ? null : normalized;
}

function buildBookingDate(preferredDate, preferredTime) {
  const datePart = safeString(preferredDate);
  const timePart = safeString(preferredTime);

  if (datePart && timePart) {
    const composed = new Date(`${datePart} ${timePart}`);
    if (!Number.isNaN(composed.getTime())) {
      return composed.toISOString();
    }
  }

  if (datePart) {
    const dateOnly = new Date(datePart);
    if (!Number.isNaN(dateOnly.getTime())) {
      dateOnly.setHours(15, 0, 0, 0);
      return dateOnly.toISOString();
    }
  }

  const fallback = new Date(Date.now() + 24 * 60 * 60 * 1000);
  fallback.setHours(15, 0, 0, 0);
  return fallback.toISOString();
}

function emit(io, event, payload) {
  if (io) {
    io.emit(event, payload);
  }
}

async function resolveUserForLead(lead, options = {}) {
  const candidateIds = [options.userId, lead?.userId]
    .map((value) => (value == null ? null : Number(value)))
    .filter(Boolean);

  for (const userId of candidateIds) {
    const user = await User.getById(userId);
    if (user) return user;
  }

  return null;
}

function resolveLeadStatus(decision) {
  const requestedStatus = safeString(decision?.leadUpdate?.status);
  if (requestedStatus) {
    return requestedStatus;
  }

  return ACTION_TO_STATUS[decision?.action] || 'new';
}

function activityDescription({ decision, lead, channel }) {
  if (safeString(decision.activityLog)) return decision.activityLog;

  const action = ACTION_TO_ACTIVITY[decision.action] || 'replied';
  return `${action} to ${lead.name} on ${channel}`;
}

async function checkWhatsApp24hWindow(lead, conversationHistory) {
  if (!lead?.phone) return null;

  const latestInbound = [...(conversationHistory || [])]
    .reverse()
    .find((item) => item.direction === 'in' && item.channel === 'whatsapp');

  if (!latestInbound) return null;

  const parsed = parseTimestamp(latestInbound.timestamp);
  if (!parsed) return null;

  const ageMs = Date.now() - parsed.getTime();
  const isOutsideWindow = ageMs > 24 * 60 * 60 * 1000;

  return isOutsideWindow
    ? 'WhatsApp message may be outside the 24-hour customer care window; template or SMS fallback may be required.'
    : null;
}

async function sendResponse(channel, lead, message, context) {
  switch (channel) {
    case 'whatsapp': {
      const windowWarning = await checkWhatsApp24hWindow(lead, context?.history || []);
      const response = await twilioService.sendWhatsApp(lead.phone, message);

      return {
        ...response,
        warning: windowWarning,
      };
    }

    case 'sms':
      return twilioService.sendSMS(lead.phone, message);

    case 'email': {
      const agencyName = context?.agencyName || 'DAB AI';
      const agencyLogo = context?.agencyLogo || null;
      return emailService.send(
        lead.email,
        'Re: Your Property Inquiry',
        message,
        message,
        { agencyName, agencyLogo }
      );
    }

    case 'instagram':
    case 'messenger': {
      // lead.phone is stored as "instagram:<IGSID>" or "messenger:<PSID>"
      const recipientId = lead.phone ? String(lead.phone).split(':').slice(1).join(':') : null;
      if (recipientId) {
        return metaService.sendMessage(recipientId, message);
      }
      return { mocked: true, success: true, sid: null, channel };
    }

    case 'web':
    case 'webchat':
      return {
        mocked: true,
        success: true,
        sid: null,
        channel: 'web',
      };

    case 'manual':
      return {
        mocked: true,
        success: true,
        sid: null,
        channel: 'manual',
      };

    default:
      return {
        mocked: true,
        success: true,
        sid: null,
        channel,
      };
  }
}

async function processMessage(message, lead, conversationHistory = [], options = {}) {
  const io = options.io;
  const channel = options.channel || lead.channel || 'web';
  const user = await resolveUserForLead(lead, options);

  const context = {
    lead,
    history: conversationHistory.slice(-10).map((item) => ({
      direction: item.direction,
      channel: item.channel,
      content: item.content,
      timestamp: item.timestamp,
    })),
    currentMessage: message,
    availableActions: ['reply', 'qualify', 'book_viewing', 'escalate', 'followup', 'close'],
    channel,
    agencyName: user?.agencyName || 'DAB AI',
    agencyLogo: user?.logoUrl || null,
    agentPersonality: user?.agentPersonality || 'Warm and professional',
    listingsData: user?.listingsData || '',
  };

  const decision = await getAgentDecision(context);

  const priorStatus = lead.status;
  const nextStatus = resolveLeadStatus(decision);

  const leadUpdatePayload = {
    status: nextStatus,
    budget: safeString(decision?.leadUpdate?.budget) ?? lead.budget,
    timeline: safeString(decision?.leadUpdate?.timeline) ?? lead.timeline,
    location: safeString(decision?.leadUpdate?.location) ?? lead.location,
    propertyType: safeString(decision?.leadUpdate?.propertyType) ?? lead.propertyType,
    sentiment: safeString(decision?.leadUpdate?.sentiment) ?? lead.sentiment ?? 'neutral',
  };

  const updatedLead = await Lead.update(lead.id, leadUpdatePayload);

  emit(io, 'lead:updated', updatedLead);
  if (priorStatus !== updatedLead.status) {
    emit(io, 'lead:moved', {
      leadId: updatedLead.id,
      lead: updatedLead,
      from: priorStatus,
      to: updatedLead.status,
    });
  }

  let booking = null;
  if (decision.action === 'book_viewing' || decision.bookingDetails?.requested) {
    booking = await Booking.create({
      leadId: updatedLead.id,
      dateTime: buildBookingDate(decision.bookingDetails?.preferredDate, decision.bookingDetails?.preferredTime),
      property: `Viewing requested (${safeString(decision.bookingDetails?.preferredDate) || 'date pending'})`,
      status: 'scheduled',
      notes: `Preferred time: ${safeString(decision.bookingDetails?.preferredTime) || 'not provided'}`,
    });

    emit(io, 'booking:created', {
      ...booking,
      leadName: updatedLead.name,
      leadChannel: updatedLead.channel,
    });
  }

  await sleep(500);

  let outMessage = null;
  let sendResult = null;

  if (!updatedLead.aiPaused && safeString(decision.message)) {
    outMessage = await Message.create({
      leadId: updatedLead.id,
      direction: 'out',
      channel,
      content: decision.message,
      sentByAI: true,
      deliveryStatus: 'queued',
      metadata: { source: 'agentBrain' },
    });

    sendResult = await sendResponse(channel, updatedLead, decision.message, context);

    if (sendResult?.success === false && channel === 'whatsapp' && updatedLead.phone) {
      const smsFallback = await twilioService.sendSMS(updatedLead.phone, decision.message);
      if (smsFallback?.success) {
        sendResult = {
          ...sendResult,
          success: true,
          warning: `WhatsApp failed; SMS fallback delivered (${smsFallback.sid || 'no sid'})`,
          fallbackChannel: 'sms',
          sid: sendResult.sid || smsFallback.sid || null,
        };
      }
    }

    const updatedOut = await Message.updateDelivery(outMessage.id, {
      externalSid: sendResult?.sid || null,
      deliveryStatus: sendResult?.success === false ? 'failed' : 'sent',
      error: sendResult?.error || sendResult?.warning || null,
    });

    outMessage = updatedOut;

    emit(io, 'message:sent', {
      ...outMessage,
      leadName: updatedLead.name,
      leadStatus: updatedLead.status,
      icon: sendResult?.success === false ? '⚠️' : '🤖',
    });

    if (sendResult?.warning) {
      const warningActivity = await ActivityLog.create({
        leadId: updatedLead.id,
        leadName: updatedLead.name,
        action: 'needs_human',
        channel,
        description: sendResult.warning,
        sentByAI: true,
      });
      emit(io, 'agent:action', warningActivity);
    }

    if (sendResult?.success === false) {
      const failedActivity = await ActivityLog.create({
        leadId: updatedLead.id,
        leadName: updatedLead.name,
        action: 'needs_human',
        channel,
        description: `Failed to send ${channel} message to ${updatedLead.name}: ${sendResult.error}`,
        sentByAI: true,
      });

      emit(io, 'agent:action', failedActivity);
      emit(io, 'agent:escalated', {
        leadId: updatedLead.id,
        leadName: updatedLead.name,
        reason: `Channel send failed: ${sendResult.error}`,
        channel,
      });
    }
  }

  const action = ACTION_TO_ACTIVITY[decision.action] || 'replied';
  const activity = await ActivityLog.create({
    leadId: updatedLead.id,
    leadName: updatedLead.name,
    action,
    channel,
    description: activityDescription({ decision, lead: updatedLead, channel }),
    sentByAI: true,
  });

  emit(io, 'agent:action', activity);

  if (decision.action === 'escalate' || updatedLead.status === 'escalated') {
    emit(io, 'agent:escalated', {
      leadId: updatedLead.id,
      leadName: updatedLead.name,
      reason: decision.escalationReason || 'Complex conversation requires human support.',
      channel,
    });
  }

  return {
    decision,
    lead: updatedLead,
    booking,
    activity,
    outMessage,
    sendResult,
    context,
  };
}

module.exports = {
  processMessage,
};
