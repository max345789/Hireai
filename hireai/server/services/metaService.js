/**
 * metaService.js
 * Handles sending + receiving messages via Meta Graph API
 * Supports: Facebook Messenger & Instagram DMs
 *
 * Required env vars:
 *   META_PAGE_ACCESS_TOKEN  – Page Access Token from Meta developer console
 *   META_VERIFY_TOKEN       – Custom string you pick; paste it in Meta webhook setup
 *   META_APP_SECRET         – App Secret (optional, for payload signature verification)
 */

const https = require('https');

const META_API_VERSION = 'v19.0';

/** Check if Meta credentials are configured */
function isConfigured() {
  return Boolean(process.env.META_PAGE_ACCESS_TOKEN && process.env.META_VERIFY_TOKEN);
}

/**
 * Verify a Meta webhook subscription challenge.
 * Meta sends a GET with hub.mode, hub.verify_token, hub.challenge.
 */
function verifyWebhook(mode, token, challenge) {
  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return { ok: true, challenge };
  }
  return { ok: false };
}

/**
 * Send a text reply via Meta Send API.
 * Works for both Messenger (page-scoped IDs) and Instagram (IGSID).
 * @param {string} recipientId – PSID or IGSID of the recipient
 * @param {string} text        – Message text to send
 */
function sendMessage(recipientId, text) {
  return new Promise((resolve, reject) => {
    const token = process.env.META_PAGE_ACCESS_TOKEN;
    if (!token) {
      // Not configured — mock success so the agent still logs internally
      return resolve({ mocked: true, success: true, recipientId });
    }

    const body = JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      messaging_type: 'RESPONSE',
    });

    const options = {
      hostname: 'graph.facebook.com',
      path: `/${META_API_VERSION}/me/messages?access_token=${encodeURIComponent(token)}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ...parsed, success: true });
          } else {
            reject(new Error(`Meta API error ${res.statusCode}: ${data}`));
          }
        } catch {
          reject(new Error(`Failed to parse Meta API response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
    return undefined;
  });
}

/**
 * Parse a raw Meta webhook POST body into a normalised array of message events.
 * Handles both Messenger (object: "page") and Instagram (object: "instagram").
 */
function parseIncoming(body) {
  const object = body?.object; // 'page' | 'instagram'
  const entries = body?.entry || [];
  const results = [];

  for (const entry of entries) {
    const messaging = entry.messaging || [];
    for (const event of messaging) {
      // Skip echoes (messages sent by the page itself)
      if (!event.message || event.message.is_echo) continue;

      const channel = object === 'instagram' ? 'instagram' : 'messenger';

      results.push({
        senderId:    event.sender?.id || null,
        text:        event.message?.text || null,
        attachments: event.message?.attachments || [],
        mid:         event.message?.mid || null,
        timestamp:   event.timestamp
          ? new Date(Number(event.timestamp)).toISOString()
          : new Date().toISOString(),
        channel,
        raw: event,
      });
    }
  }

  return results;
}

module.exports = { isConfigured, verifyWebhook, sendMessage, parseIncoming };
