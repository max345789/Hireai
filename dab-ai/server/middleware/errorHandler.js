const logger = require('../services/logger');

function notFound(_req, res) {
  return res.status(404).json({ error: 'Not found' });
}

function errorHandler(error, req, res, _next) {
  logger.error('unhandled_error', {
    requestId: req.requestId,
    path: req.originalUrl,
    method: req.method,
    error: error?.message || 'Unknown error',
    stack: process.env.NODE_ENV === 'production' ? undefined : error?.stack,
  });

  if (res.headersSent) {
    return;
  }

  const status = Number(error?.status || error?.statusCode || 500);
  const body = {
    error: status >= 500 ? 'Internal server error' : (error?.message || 'Request failed'),
    requestId: req.requestId,
  };

  res.status(status).json(body);
}

module.exports = {
  notFound,
  errorHandler,
};
