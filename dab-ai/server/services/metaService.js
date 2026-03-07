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
const { env } = require('../config/env');

const META_API_VERSION = 'v19.0';

function requestJson({ hostname, path, method = 'GET', body = null }) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname,
      path,
      method,
      headers: payload
        ? {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          }
        : {},
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = data ? JSON.parse(data) : {};
        } catch {
          parsed = { raw: data };
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed);
        } else {
          reject(new Error(`Meta API error ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/** Check if Meta credentials are configured */
function isConfigured(options = {}) {
  return Boolean(
    (options.accessToken || process.env.META_PAGE_ACCESS_TOKEN) &&
    (options.verifyToken || process.env.META_VERIFY_TOKEN)
  );
}

/**
 * Verify a Meta webhook subscription challenge.
 * Meta sends a GET with hub.mode, hub.verify_token, hub.challenge.
 */
function verifyWebhook(mode, token, challenge, options = {}) {
  const verifyToken = options.verifyToken || process.env.META_VERIFY_TOKEN;
  if (mode === 'subscribe' && token === verifyToken) {
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
function sendMessage(recipientId, text, options = {}) {
  return new Promise((resolve, reject) => {
    const token = options.accessToken || process.env.META_PAGE_ACCESS_TOKEN;
    if (!token) {
      if (!env.allowMockDelivery) {
        return resolve({
          mocked: false,
          success: false,
          recipientId,
          error: 'Meta Graph API is not configured',
        });
      }

      // Not configured — allow demo mode when mock delivery is enabled.
      return resolve({ mocked: true, success: true, recipientId });
    }

    const body = JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      messaging_type: 'RESPONSE',
    });

    const requestOptions = {
      hostname: 'graph.facebook.com',
      path: `/${META_API_VERSION}/me/messages?access_token=${encodeURIComponent(token)}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(requestOptions, (res) => {
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

async function exchangeCodeForUserToken({ code, redirectUri, appId, appSecret }) {
  if (!code) throw new Error('Missing Meta OAuth code');
  if (!redirectUri || !appId || !appSecret) {
    throw new Error('Missing Meta OAuth app configuration');
  }

  const path =
    `/${META_API_VERSION}/oauth/access_token?client_id=${encodeURIComponent(appId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&client_secret=${encodeURIComponent(appSecret)}` +
    `&code=${encodeURIComponent(code)}`;

  return requestJson({
    hostname: 'graph.facebook.com',
    path,
  });
}

async function getManagedPages(accessToken) {
  if (!accessToken) return [];

  const path =
    `/${META_API_VERSION}/me/accounts?fields=id,name,access_token` +
    `&access_token=${encodeURIComponent(accessToken)}`;

  const parsed = await requestJson({
    hostname: 'graph.facebook.com',
    path,
  });

  return Array.isArray(parsed?.data) ? parsed.data : [];
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
        recipientId: event.recipient?.id || null,
        text:        event.message?.text || null,
        attachments: event.message?.attachments || [],
        mid:         event.message?.mid || null,
        pageId:      entry.id || null,
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

module.exports = {
  isConfigured,
  verifyWebhook,
  sendMessage,
  parseIncoming,
  exchangeCodeForUserToken,
  getManagedPages,
};
