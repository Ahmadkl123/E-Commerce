const express = require('express');
const router = express.Router();
const ordersController = require('../controllers/ordersController');
const { authenticateToken } = require('../middleware/auth');

// All order endpoints require authentication
router.use(authenticateToken);

router.post('/', ordersController.createOrder);
router.get('/', ordersController.getOrders);

module.exports = router;
