/**
 * Slack Notification Service
 * Sends webhook notifications to Slack channels.
 */

async function sendSlackNotification(webhookUrl, payload) {
  if (!webhookUrl) return { ok: false, reason: 'no_webhook' };

  try {
    const body = typeof payload === 'string'
      ? { text: payload }
      : payload;

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return { ok: res.ok, status: res.status };
  } catch (err) {
    console.error('[slackService] failed:', err.message);
    return { ok: false, reason: err.message };
  }
}

function buildLeadAlert({ leadName, channel, action, description }) {
  const emoji = {
    qualified: '✅',
    booked: '📅',
    escalated: '🚨',
    needs_human: '👤',
    replied: '💬',
    followed_up: '🔄',
  }[action] || '📌';

  return {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emoji} *${action.replace('_', ' ').toUpperCase()}* — ${leadName}`,
        },
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `Channel: *${channel}*` },
          { type: 'mrkdwn', text: description || '' },
        ],
      },
    ],
  };
}

module.exports = { sendSlackNotification, buildLeadAlert };
