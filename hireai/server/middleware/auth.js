const jwt = require('jsonwebtoken');
const { env } = require('../config/env');

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token' });
  }

  const token = header.replace('Bearer ', '').trim();

  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    req.user = decoded;
    return next();
  } catch (_error) {
    return res.status(401).json({ error: 'Invalid auth token' });
  }
}

module.exports = {
  requireAuth,
};
