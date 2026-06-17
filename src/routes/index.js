const express = require('express');
const router = express.Router();

const { getMenu, getMenuItem, toggleAvailability, createMenuItem, updateMenuItem, deleteMenuItem } = require('../controllers/menuController');
const { createOrder, getOrder, updateOrderStatus, getActiveOrders, getOrderHistory } = require('../controllers/ordersController');
const { initiatePayment, handleWebhook, getPaymentStatus } = require('../controllers/paymentsController');
const adminAuth = require('../middleware/adminAuth');

// ── Menu ──────────────────────────────────────────────────────────────────────
router.get('/menu',                          getMenu);
router.get('/menu/:id',                      getMenuItem);
router.post('/menu',              adminAuth, createMenuItem);
router.put('/menu/:id',           adminAuth, updateMenuItem);
router.delete('/menu/:id',        adminAuth, deleteMenuItem);
router.patch('/menu/:id/availability', adminAuth, toggleAvailability);

// ── Orders ────────────────────────────────────────────────────────────────────
router.post('/orders',                       createOrder);
router.get('/orders/history',    adminAuth, getOrderHistory);
router.get('/orders',            adminAuth, getActiveOrders);
router.get('/orders/:id',                    getOrder);
router.patch('/orders/:id/status', adminAuth, updateOrderStatus);

// ── Payments ──────────────────────────────────────────────────────────────────
router.post('/payments/initiate',            initiatePayment);
router.post('/payments/webhook',             handleWebhook);
router.get('/payments/:id/status',           getPaymentStatus);

module.exports = router;
