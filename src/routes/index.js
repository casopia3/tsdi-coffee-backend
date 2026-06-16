const express = require('express');
const router = express.Router();

const { getMenu, getMenuItem, toggleAvailability } = require('../controllers/menuController');
const { createOrder, getOrder, updateOrderStatus, getActiveOrders } = require('../controllers/ordersController');
const { initiatePayment, handleWebhook, getPaymentStatus } = require('../controllers/paymentsController');
const adminAuth = require('../middleware/adminAuth');

// ── Menu ──────────────────────────────────────────────────────────────────────
router.get('/menu',                          getMenu);
router.get('/menu/:id',                      getMenuItem);
router.patch('/menu/:id/availability', adminAuth, toggleAvailability);  // admin

// ── Orders ────────────────────────────────────────────────────────────────────
router.post('/orders',                       createOrder);       // customer places order
router.get('/orders',              adminAuth, getActiveOrders);  // kitchen dashboard
router.get('/orders/:id',                    getOrder);          // customer order status
router.patch('/orders/:id/status', adminAuth, updateOrderStatus);// kitchen updates status

// ── Payments ──────────────────────────────────────────────────────────────────
router.post('/payments/initiate',            initiatePayment);   // customer initiates payment
router.post('/payments/webhook',             handleWebhook);     // Chapa calls this
router.get('/payments/:id/status',           getPaymentStatus);  // customer polls status

module.exports = router;
