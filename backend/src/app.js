const express = require('express');
const cors = require('cors');

const app = express();

// Enable Cross-Origin Resource Sharing (CORS) so the React frontend can consume the API
app.use(cors());

// Parse incoming requests with JSON payloads.
// The limit is raised so product photos uploaded from the admin form
// (sent as compressed base64 data URLs) fit in a single request.
app.use(express.json({ limit: '5mb' }));

// Health Check Endpoint
// Used by monitoring services, load balancers, and CI pipelines to verify backend availability
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// API Routes
const authRouter = require('./routes/auth');
const productsRouter = require('./routes/products');
const cartRouter = require('./routes/cart');
const ordersRouter = require('./routes/orders');
const paymentsRouter = require('./routes/payments');

app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/cart', cartRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/payments', paymentsRouter);

// 404 Handler for undefined routes
app.use((req, res, next) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Centralized Error Handling Middleware
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

module.exports = app;
