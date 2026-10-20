const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'ecommerce_jwt_dev_secret_key_12345';

/**
 * Middleware: Verify JWT Authentication Token
 * Validates the Authorization header ("Bearer <token>") and attaches the decoded
 * user payload to req.user.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Authorization header format must be: Bearer <token>' });
  }

  const token = parts[1];

  jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    req.user = decodedUser;
    next();
  });
}

/**
 * Middleware: Require Administrator Role
 * Must be used after authenticateToken. Verifies that req.user.role === 'admin'.
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  next();
}

module.exports = {
  authenticateToken,
  requireAdmin
};
