const express = require('express');
const router = express.Router();

const { login, changePassword } = require('../controllers/authController');
const adminAuth = require('../middleware/adminAuth');

// Public — checks the typed password against stored hashes
router.post('/login', login);

// Protected — only a valid admin or kitchen token can reach this;
// the role-based "who can change whose password" rule lives in the controller
router.patch('/change-password', adminAuth, changePassword);

module.exports = router;
