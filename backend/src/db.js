const mysql = require('mysql2/promise');
require('dotenv').config();

// Create a connection pool instead of a single connection.
// A pool maintains multiple active database connections that are reused across requests,
// significantly improving performance by eliminating the overhead of repeatedly handshaking TCP connections.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'ecommerce_user',
  password: process.env.DB_PASSWORD || 'ecommerce_password',
  database: process.env.DB_NAME || 'ecommerce_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;
