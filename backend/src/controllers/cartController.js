const pool = require('../db');

/**
 * GET /api/cart
 * Retrieves all items in the authenticated user's shopping cart.
 */
async function getCart(req, res, next) {
  try {
    const userId = req.user.id;

    // Join cart_items with products to retrieve current product info and price
    const [rows] = await pool.query(
      `SELECT 
        ci.id AS cart_item_id,
        ci.product_id,
        ci.quantity,
        p.name,
        p.price,
        p.stock,
        (ci.quantity * p.price) AS subtotal
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.user_id = ?
       ORDER BY ci.id ASC`,
      [userId]
    );

    let total = 0;
    const items = rows.map((item) => {
      const price = Number(item.price);
      const subtotal = Number((price * item.quantity).toFixed(2));
      total += subtotal;

      return {
        cartItemId: item.cart_item_id,
        productId: item.product_id,
        name: item.name,
        price,
        stock: item.stock,
        quantity: item.quantity,
        subtotal
      };
    });

    return res.status(200).json({
      items,
      total: Number(total.toFixed(2))
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/cart
 * Adds an item to the authenticated user's shopping cart or increases quantity.
 * Body: { productId: number, quantity?: number }
 */
async function addToCart(req, res, next) {
  try {
    const userId = req.user.id;
    const { productId, quantity = 1 } = req.body;

    const parsedProductId = parseInt(productId, 10);
    const parsedQuantity = parseInt(quantity, 10);

    // Validate inputs
    if (isNaN(parsedProductId) || parsedProductId <= 0) {
      return res.status(400).json({ error: 'Valid productId is required.' });
    }

    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive integer.' });
    }

    // 1. Verify product exists and check current stock in database
    const [products] = await pool.query(
      'SELECT id, name, price, stock FROM products WHERE id = ?',
      [parsedProductId]
    );

    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const product = products[0];

    // 2. Check existing cart quantity for this user and product
    const [existingCart] = await pool.query(
      'SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?',
      [userId, parsedProductId]
    );

    const currentCartQty = existingCart.length > 0 ? existingCart[0].quantity : 0;
    const finalQuantity = currentCartQty + parsedQuantity;

    // Ensure requested total quantity does not exceed available product inventory
    if (finalQuantity > product.stock) {
      return res.status(400).json({
        error: `Insufficient stock for '${product.name}'. Available: ${product.stock}, in cart: ${currentCartQty}.`
      });
    }

    // 3. Upsert into cart_items (MySQL ON DUPLICATE KEY UPDATE)
    await pool.query(
      `INSERT INTO cart_items (user_id, product_id, quantity) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE quantity = ?`,
      [userId, parsedProductId, finalQuantity, finalQuantity]
    );

    return res.status(200).json({
      message: 'Item added to cart successfully',
      item: {
        productId: product.id,
        name: product.name,
        unitPrice: Number(product.price),
        quantity: finalQuantity,
        subtotal: Number((Number(product.price) * finalQuantity).toFixed(2))
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/cart/:productId
 * Removes a product completely from the user's shopping cart.
 */
async function removeFromCart(req, res, next) {
  try {
    const userId = req.user.id;
    const productId = parseInt(req.params.productId, 10);

    if (isNaN(productId) || productId <= 0) {
      return res.status(400).json({ error: 'Valid productId is required.' });
    }

    const [result] = await pool.query(
      'DELETE FROM cart_items WHERE user_id = ? AND product_id = ?',
      [userId, productId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Item not found in cart.' });
    }

    return res.status(200).json({
      message: 'Item removed from cart successfully'
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCart,
  addToCart,
  removeFromCart
};
