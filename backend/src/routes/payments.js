const express = require('express');
const router = express.Router();
const paymentsController = require('../controllers/paymentsController');
const { authenticateToken } = require('../middleware/auth');

// Public: tells the storefront which payment providers are available.
router.get('/config', paymentsController.getConfig);

// Authenticated: create a provider payment for the signed-in user's cart.
router.post('/stripe/intent', authenticateToken, paymentsController.createStripeIntent);
router.post('/paypal/order', authenticateToken, paymentsController.createPaypalOrder);

module.exports = router;
