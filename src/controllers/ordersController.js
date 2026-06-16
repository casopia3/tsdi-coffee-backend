const pool = require('../db/pool');

const SERVICE_CHARGE_RATE = 0.05; // 5%

// POST /api/orders
const createOrder = async (req, res) => {
  const { table_number, items, notes } = req.body;

  // Basic validation
  if (!table_number) {
    return res.status(400).json({ success: false, message: 'table_number is required' });
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'items array is required and must not be empty' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch current prices from DB (never trust client-side prices)
    const itemIds = items.map((i) => i.menu_item_id);
    const menuResult = await client.query(
      `SELECT id, name, price, is_available FROM menu_items WHERE id = ANY($1)`,
      [itemIds]
    );

    const menuMap = {};
    for (const row of menuResult.rows) {
      menuMap[row.id] = row;
    }

    // Validate all items exist and are available
    for (const item of items) {
      const dbItem = menuMap[item.menu_item_id];
      if (!dbItem) {
        throw new Error(`Menu item ${item.menu_item_id} not found`);
      }
      if (!dbItem.is_available) {
        throw new Error(`"${dbItem.name}" is currently unavailable`);
      }
      if (!item.quantity || item.quantity < 1) {
        throw new Error(`Invalid quantity for item ${item.menu_item_id}`);
      }
    }

    // Calculate totals using DB prices
    let subtotal = 0;
    for (const item of items) {
      subtotal += parseFloat(menuMap[item.menu_item_id].price) * item.quantity;
    }
    const serviceCharge = parseFloat((subtotal * SERVICE_CHARGE_RATE).toFixed(2));
    const total = parseFloat((subtotal + serviceCharge).toFixed(2));

    // Create the order
    const orderResult = await client.query(
      `INSERT INTO orders (table_number, notes, subtotal, service_charge, total)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [table_number, notes || null, subtotal, serviceCharge, total]
    );
    const order = orderResult.rows[0];

    // Insert order items
    for (const item of items) {
      const dbItem = menuMap[item.menu_item_id];
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, name, price, quantity)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, item.menu_item_id, dbItem.name, dbItem.price, item.quantity]
      );
    }

    await client.query('COMMIT');

    // Return full order with items
    const fullOrder = await getOrderById(order.id);
    res.status(201).json({ success: true, data: fullOrder });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createOrder error:', err.message);
    res.status(400).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

// GET /api/orders/:id
const getOrder = async (req, res) => {
  try {
    const order = await getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch order' });
  }
};

// PATCH /api/orders/:id/status  (kitchen use)
const updateOrderStatus = async (req, res) => {
  const VALID_STATUSES = ['confirmed', 'preparing', 'ready', 'served', 'cancelled'];
  const { status } = req.body;

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Status must be one of: ${VALID_STATUSES.join(', ')}`
    });
  }

  try {
    const result = await pool.query(
      `UPDATE orders SET status = $1 WHERE id = $2
       RETURNING id, status, table_number, updated_at`,
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update status' });
  }
};

// GET /api/orders  (kitchen dashboard — active orders)
const getActiveOrders = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        o.id, o.table_number, o.status, o.total,
        o.created_at, o.updated_at,
        json_agg(
          json_build_object(
            'name', oi.name,
            'quantity', oi.quantity,
            'price', oi.price
          ) ORDER BY oi.id
        ) AS items
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      WHERE o.status NOT IN ('served', 'cancelled')
      GROUP BY o.id
      ORDER BY o.created_at ASC;
    `);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch orders' });
  }
};

// Helper: fetch a single order with its items and payment
async function getOrderById(id) {
  const orderRes = await pool.query(
    `SELECT * FROM orders WHERE id = $1`, [id]
  );
  if (orderRes.rows.length === 0) return null;

  const itemsRes = await pool.query(
    `SELECT name, price, quantity, subtotal FROM order_items WHERE order_id = $1 ORDER BY id`,
    [id]
  );
  const paymentRes = await pool.query(
    `SELECT method, status, amount, tx_ref FROM payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [id]
  );

  return {
    ...orderRes.rows[0],
    items: itemsRes.rows,
    payment: paymentRes.rows[0] || null,
  };
}

module.exports = { createOrder, getOrder, updateOrderStatus, getActiveOrders };
