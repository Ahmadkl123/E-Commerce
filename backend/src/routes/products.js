const express = require('express');
const router = express.Router();
const productsController = require('../controllers/productsController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Public catalog routes
router.get('/', productsController.getAllProducts);
router.get('/:id', productsController.getProductById);

// Admin-only management routes
router.post('/', authenticateToken, requireAdmin, productsController.createProduct);
router.put('/:id', authenticateToken, requireAdmin, productsController.updateProduct);
router.delete('/:id', authenticateToken, requireAdmin, productsController.deleteProduct);

module.exports = router;
