const crypto = require('crypto');
const IdempotencyKey = require('../models/IdempotencyKey');
const logger = require('../services/logger');

function hashPayload(req) {
  const payload = {
    method: req.method,
    path: req.originalUrl,
    body: req.body || {},
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}

function makeScope(scope, req) {
  if (typeof scope === 'function') return scope(req);
  return scope;
}

function idempotency({ scope, ttlHours = 24 } = {}) {
  return async (req, res, next) => {
    const key = req.headers['idempotency-key'];

    if (!key) {
      return next();
    }

    const normalizedKey = String(key).trim();
    if (normalizedKey.length < 8 || normalizedKey.length > 128) {
      return res.status(400).json({ error: 'Invalid Idempotency-Key header' });
    }

    const resolvedScope = makeScope(scope || req.path, req);
    const requestHash = hashPayload(req);

    const existing = await IdempotencyKey.get(resolvedScope, normalizedKey);

    if (existing) {
      if (existing.requestHash !== requestHash) {
        return res.status(409).json({ error: 'Idempotency-Key reused with a different payload' });
      }

      if (existing.status === 'completed' && existing.responseBody) {
        try {
          const parsed = JSON.parse(existing.responseBody);
          res.setHeader('x-idempotency-replayed', 'true');
          return res.status(existing.statusCode || 200).json(parsed);
        } catch {
          return res.status(existing.statusCode || 200).send(existing.responseBody);
        }
      }

      if (existing.status === 'processing') {
        return res.status(409).json({ error: 'Request with same Idempotency-Key is still processing' });
      }

      if (existing.status === 'failed') {
        await IdempotencyKey.markProcessing(existing.id);
      }
    }

    const reservation = await IdempotencyKey.reserve(resolvedScope, normalizedKey, requestHash, ttlHours);
    req.idempotencyKeyRow = reservation?.row || null;

    const originalJson = res.json.bind(res);
    res.json = async (body) => {
      const payload = body == null ? null : JSON.stringify(body);

      if (req.idempotencyKeyRow?.id) {
        try {
          const statusCode = res.statusCode || 200;
          if (statusCode >= 500) {
            await IdempotencyKey.fail(req.idempotencyKeyRow.id, statusCode, payload);
          } else {
            await IdempotencyKey.complete(req.idempotencyKeyRow.id, statusCode, payload);
          }
        } catch (error) {
          logger.error('idempotency_finalize_failed', {
            requestId: req.requestId,
            error: error.message,
            scope: resolvedScope,
          });
        }
      }

      return originalJson(body);
    };

    next();
  };
}

module.exports = {
  idempotency,
};
