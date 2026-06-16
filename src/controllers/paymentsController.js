const pool = require('../db/pool');

const CHAPA_API = 'https://api.chapa.co/v1';

// POST /api/payments/initiate
const initiatePayment = async (req, res) => {
  const { order_id, method, customer_phone } = req.body;

  if (!order_id || !method) {
    return res.status(400).json({ success: false, message: 'order_id and method are required' });
  }

  const VALID_METHODS = ['chapa', 'telebirr', 'card', 'cash'];
  if (!VALID_METHODS.includes(method)) {
    return res.status(400).json({ success: false, message: 'Invalid payment method' });
  }

  try {
    // Fetch the order
    const orderRes = await pool.query(
      `SELECT * FROM orders WHERE id = $1`, [order_id]
    );
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    const order = orderRes.rows[0];

    if (order.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Order is cancelled' });
    }

    // ── Cash payment: no API call needed ──────────────────────────────────
    if (method === 'cash') {
      const payment = await pool.query(
        `INSERT INTO payments (order_id, method, status, amount)
         VALUES ($1, 'cash', 'pending', $2)
         RETURNING *`,
        [order_id, order.total]
      );

      // Do NOT auto-confirm — kitchen staff must verify cash payment first

      return res.status(201).json({
        success: true,
        data: {
          payment_id: payment.rows[0].id,
          method: 'cash',
          message: 'Show this order number to the cashier when paying.',
          order_total: order.total,
        },
      });
    }

    // ── Chapa / Telebirr / Card: call Chapa API ────────────────────────────
    const tx_ref = `HB-${order_id.slice(0, 8)}-${Date.now()}`;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const chapaPayload = {
      amount: order.total.toString(),
      currency: 'ETB',
      tx_ref,
      callback_url: `${process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000'}/api/payments/webhook`,
      return_url: `${frontendUrl}/order/${order_id}`,
      customization: {
        title: 'Tsdi Coffee',
        description: `Order for Table ${order.table_number}`,
      },
    };

    // Add phone for Telebirr
    if (method === 'telebirr' && customer_phone) {
      chapaPayload.phone_number = customer_phone;
    }

    const chapaRes = await fetch(`${CHAPA_API}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chapaPayload),
    });

    const chapaData = await chapaRes.json();

    if (chapaData.status !== 'success') {
      console.error('Chapa error:', chapaData);
      return res.status(502).json({
        success: false,
        message: chapaData.message || 'Payment gateway error. Try again.',
      });
    }

    // Save pending payment record
    const payment = await pool.query(
      `INSERT INTO payments (order_id, method, status, amount, tx_ref, chapa_checkout_url)
       VALUES ($1, $2, 'pending', $3, $4, $5)
       RETURNING id`,
      [order_id, method, order.total, tx_ref, chapaData.data.checkout_url]
    );

    res.status(201).json({
      success: true,
      data: {
        payment_id: payment.rows[0].id,
        checkout_url: chapaData.data.checkout_url, // frontend redirects here
        tx_ref,
      },
    });

  } catch (err) {
    console.error('initiatePayment error:', err.message);
    res.status(500).json({ success: false, message: 'Payment initiation failed' });
  }
};

// POST /api/payments/webhook  (Chapa calls this after payment)
const handleWebhook = async (req, res) => {
  const { tx_ref, status } = req.body;

  // Always respond 200 to Chapa immediately
  res.sendStatus(200);

  if (!tx_ref) return;

  try {
    // Verify with Chapa (don't trust the webhook body alone)
    const verifyRes = await fetch(`${CHAPA_API}/transaction/verify/${tx_ref}`, {
      headers: { Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}` },
    });
    const verifyData = await verifyRes.json();

    const paymentStatus = verifyData.data?.status === 'success' ? 'completed' : 'failed';

    // Update payment record
    const paymentResult = await pool.query(
      `UPDATE payments
       SET status = $1, verified_at = NOW()
       WHERE tx_ref = $2
       RETURNING order_id`,
      [paymentStatus, tx_ref]
    );

    if (paymentResult.rows.length === 0) return;

    // Update order status if payment succeeded
    if (paymentStatus === 'completed') {
      await pool.query(
        `UPDATE orders SET status = 'confirmed' WHERE id = $1`,
        [paymentResult.rows[0].order_id]
      );
    }

  } catch (err) {
    console.error('Webhook processing error:', err.message);
  }
};

// GET /api/payments/:id/status
const getPaymentStatus = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.status, p.method, p.amount, o.status AS order_status
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       WHERE p.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch payment status' });
  }
};

module.exports = { initiatePayment, handleWebhook, getPaymentStatus };