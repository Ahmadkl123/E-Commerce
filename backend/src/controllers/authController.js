const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'ecommerce_jwt_dev_secret_key_12345';
const SALT_ROUNDS = 10;

/**
 * Basic email format validator
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * POST /api/auth/register
 * Registers a new customer account.
 */
async function register(req, res, next) {
  try {
    const { email, password } = req.body;

    // Validate email
    if (!email || typeof email !== 'string' || !isValidEmail(email.trim())) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }

    // Validate password length
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if email already registered (parameterized query)
    const [existingUsers] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [normalizedEmail]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Hash the password with bcrypt (never store plain-text passwords!)
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Default role for self-registration is always 'customer'
    const [result] = await pool.query(
      'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
      [normalizedEmail, passwordHash, 'customer']
    );

    // Respond with user info (NEVER return password_hash!)
    return res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: result.insertId,
        email: normalizedEmail,
        role: 'customer'
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/login
 * Authenticates user credentials and issues a signed JSON Web Token (JWT).
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Look up user by email
    const [users] = await pool.query(
      'SELECT id, email, password_hash, role FROM users WHERE email = ?',
      [normalizedEmail]
    );

    // Avoid revealing whether it was the email or password that was incorrect
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = users[0];

    // Verify password against stored bcrypt hash
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Generate signed JWT token including user ID and role in payload
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Return token and safe user profile (without password hash)
    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
  login
};
