const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { authenticateToken } = require('../middleware/auth');

// All cart endpoints require user authentication
router.use(authenticateToken);

router.get('/', cartController.getCart);
router.post('/', cartController.addToCart);
router.delete('/:productId', cartController.removeFromCart);

module.exports = router;
