const pool = require('../db');

/**
 * POST /api/orders
 * Converts items in the user's shopping cart into a confirmed order.
 * 
 * ACID Transaction requirements:
 * 1. Acquire connection from pool
 * 2. Start transaction (beginTransaction)
 * 3. Lock and verify stock for all cart items
 * 4. Calculate total strictly from DB prices (never trust client)
 * 5. Insert record into `orders`
 * 6. Insert records into `order_items` with unit_price snapshot
 * 7. Decrement product stock
 * 8. Empty the user's cart
 * 9. Commit transaction and release connection in finally block
 */
async function createOrder(req, res, next) {
  const userId = req.user.id;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Fetch current cart items with latest product prices and stocks.
    // 'FOR UPDATE' places an exclusive lock on the selected product rows until commit/rollback,
    // preventing race conditions where two users attempt to purchase the same inventory simultaneously.
    const [cartItems] = await connection.query(
      `SELECT 
        ci.id AS cart_item_id,
        ci.product_id,
        ci.quantity,
        p.name,
        p.price,
        p.stock
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.user_id = ?
       FOR UPDATE`,
      [userId]
    );

    // Cannot order an empty cart
    if (cartItems.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Cannot create order: Shopping cart is empty.' });
    }

    // 2. Validate stock availability for each item in the cart
    for (const item of cartItems) {
      if (item.quantity > item.stock) {
        await connection.rollback();
        return res.status(400).json({
          error: `Insufficient stock for product '${item.name}'. Available: ${item.stock}, in cart: ${item.quantity}.`
        });
      }
    }

    // 3. Calculate order total strictly on the server from database prices
    let orderTotal = 0;
    for (const item of cartItems) {
      const unitPrice = Number(item.price);
      orderTotal += unitPrice * item.quantity;
    }
    const finalTotal = Number(orderTotal.toFixed(2));

    // 4. Create Order entry
    const [orderResult] = await connection.query(
      'INSERT INTO orders (user_id, total, status) VALUES (?, ?, ?)',
      [userId, finalTotal, 'pending']
    );
    const orderId = orderResult.insertId;

    // 5. Insert order line items and decrement stock for each product
    for (const item of cartItems) {
      const unitPrice = Number(item.price);

      // Snapshot the exact unit_price at the time of purchase
      await connection.query(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
        [orderId, item.product_id, item.quantity, unitPrice]
      );

      // Decrement inventory stock
      await connection.query(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }

    // 6. Clear shopping cart
    await connection.query('DELETE FROM cart_items WHERE user_id = ?', [userId]);

    // 7. Commit transaction
    await connection.commit();

    return res.status(201).json({
      message: 'Order created successfully',
      order: {
        id: orderId,
        userId,
        total: finalTotal,
        status: 'pending',
        itemsCount: cartItems.length
      }
    });
  } catch (error) {
    // On any error, rollback all changes made during this transaction
    await connection.rollback();
    next(error);
  } finally {
    // ALWAYS release the connection back to the pool so it can be reused
    connection.release();
  }
}

/**
 * GET /api/orders
 * Retrieves all previous orders placed by the authenticated user with line items.
 */
async function getOrders(req, res, next) {
  try {
    const userId = req.user.id;

    // Retrieve user orders ordered by most recent first
    const [orders] = await pool.query(
      'SELECT id, total, status, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );

    if (orders.length === 0) {
      return res.status(200).json([]);
    }

    // Retrieve all line items for user's orders
    const [items] = await pool.query(
      `SELECT 
        oi.id,
        oi.order_id,
        oi.product_id,
        oi.quantity,
        oi.unit_price,
        p.name AS product_name
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       JOIN orders o ON oi.order_id = o.id
       WHERE o.user_id = ?
       ORDER BY oi.id ASC`,
      [userId]
    );

    // Map line items into corresponding orders
    const ordersMap = new Map();
    for (const order of orders) {
      ordersMap.set(order.id, {
        id: order.id,
        total: Number(order.total),
        status: order.status,
        createdAt: order.created_at,
        items: []
      });
    }

    for (const item of items) {
      const order = ordersMap.get(item.order_id);
      if (order) {
        order.items.push({
          id: item.id,
          productId: item.product_id,
          productName: item.product_name,
          quantity: item.quantity,
          unitPrice: Number(item.unit_price),
          subtotal: Number((Number(item.unit_price) * item.quantity).toFixed(2))
        });
      }
    }

    return res.status(200).json(Array.from(ordersMap.values()));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createOrder,
  getOrders
};
