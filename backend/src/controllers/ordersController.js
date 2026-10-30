const pool = require('../db');
const { PaymentError, verifyPayment, toCents } = require('../services/payments');
const { buildReceipt } = require('../services/receipt');

/**
 * Refunds a provider payment when the order cannot be completed after the
 * money was taken (for example stock ran out while the buyer was paying).
 * Never throws: a failed refund is logged so it can be handled by hand.
 */
async function refundQuietly(paid) {
  if (!paid?.refund) return;
  try {
    await paid.refund();
  } catch (err) {
    console.error(`REFUND FAILED for payment ${paid.reference}: ${err.message}`);
  }
}

/**
 * POST /api/orders
 * Converts items in the user's shopping cart into a confirmed order.
 *
 * Body (optional): { payment } — see services/payments.js. With Stripe or
 * PayPal configured a verified payment is required; the provider's amount must
 * equal the server-computed total, otherwise the payment is refunded.
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

  // 0. Verify the payment before touching order data.
  let paid;
  try {
    paid = await verifyPayment(req.body?.payment, userId);
  } catch (error) {
    if (error instanceof PaymentError) return res.status(error.status).json({ error: error.message });
    return next(error);
  }

  // A provider payment can only ever pay for one order.
  if (paid?.reference) {
    const [existing] = await pool.query('SELECT id FROM orders WHERE payment_reference = ?', [paid.reference]);
    if (existing.length > 0) {
      return res.status(409).json({ error: `This payment was already used for order #${existing[0].id}.` });
    }
  }

  const status = paid ? 'paid' : 'pending';
  const connection = await pool.getConnection();

  // Rolls back, refunds any provider payment and answers with an error.
  const fail = async (code, message) => {
    await connection.rollback();
    await refundQuietly(paid);
    const refunded = paid?.refund ? ' Your payment has been refunded.' : '';
    return res.status(code).json({ error: message + refunded });
  };

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
      return await fail(400, 'Cannot create order: Shopping cart is empty.');
    }

    // 2. Validate stock availability for each item in the cart
    for (const item of cartItems) {
      if (item.quantity > item.stock) {
        return await fail(
          400,
          `Insufficient stock for product '${item.name}'. Available: ${item.stock}, in cart: ${item.quantity}.`
        );
      }
    }

    // 3. Calculate order total strictly on the server from database prices
    let orderTotal = 0;
    for (const item of cartItems) {
      const unitPrice = Number(item.price);
      orderTotal += unitPrice * item.quantity;
    }
    const finalTotal = Number(orderTotal.toFixed(2));

    // The amount the provider actually charged must match the order total.
    if (paid?.amountCents !== undefined && paid.amountCents !== toCents(finalTotal)) {
      return await fail(409, 'Your cart changed during payment. Please check out again.');
    }

    // 4. Create Order entry (with the payment summary when the order was paid at checkout)
    const [orderResult] = paid
      ? await connection.query(
          'INSERT INTO orders (user_id, total, status, payment_method, payment_details, payment_reference) VALUES (?, ?, ?, ?, ?, ?)',
          [userId, finalTotal, status, paid.method, paid.details, paid.reference]
        )
      : await connection.query(
          'INSERT INTO orders (user_id, total, status) VALUES (?, ?, ?)',
          [userId, finalTotal, status]
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
        status,
        paymentMethod: paid ? paid.method : null,
        paymentDetails: paid ? paid.details : null,
        itemsCount: cartItems.length
      }
    });
  } catch (error) {
    // On any error, rollback all changes made during this transaction
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY' && paid?.reference) {
      // Another request used the same payment at the same moment; it owns the order.
      return res.status(409).json({ error: 'This payment was already used for another order.' });
    }
    await refundQuietly(paid);
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
      'SELECT id, total, status, payment_method, payment_details, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC',
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
        p.name AS product_name,
        p.image_url
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
        paymentMethod: order.payment_method ?? null,
        paymentDetails: order.payment_details ?? null,
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
          imageUrl: item.image_url,
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

/**
 * GET /api/orders/:id/receipt
 * Downloads a PDF receipt for one of the authenticated user's orders.
 * Another user's order answers 404 so order ids cannot be probed.
 */
async function getReceipt(req, res, next) {
  try {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId < 1) {
      return res.status(400).json({ error: 'Invalid order id.' });
    }

    const [orders] = await pool.query(
      `SELECT o.id, o.user_id, o.total, o.status, o.payment_method, o.payment_details,
              o.payment_reference, o.created_at, u.email
       FROM orders o
       JOIN users u ON o.user_id = u.id
       WHERE o.id = ?`,
      [orderId]
    );
    const order = orders[0];
    if (!order || order.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const [items] = await pool.query(
      `SELECT oi.quantity, oi.unit_price, p.name AS product_name
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?
       ORDER BY oi.id ASC`,
      [orderId]
    );

    const pdf = await buildReceipt({ order, items, customerEmail: order.email });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="kestrel-receipt-${orderId}.pdf"`,
      'Content-Length': pdf.length,
    });
    return res.status(200).send(pdf);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createOrder,
  getOrders,
  getReceipt
};
