const crypto = require('crypto');
const logger = require('../services/logger');

function makeRequestId() {
  return crypto.randomBytes(8).toString('hex');
}

function requestContext(req, res, next) {
  const requestId = req.headers['x-request-id'] || makeRequestId();
  req.requestId = String(requestId);
  res.setHeader('x-request-id', req.requestId);

  const start = Date.now();

  res.on('finish', () => {
    logger.info('http_request', {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || null,
      userId: req.user?.id || null,
    });
  });

  next();
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  requestContext,
  asyncHandler,
};
