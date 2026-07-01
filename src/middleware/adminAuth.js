const pool = require('../db/pool');
const bcrypt = require('bcrypt');

// Verifies the Bearer token (the plain password the user typed) against
// the hashed passwords stored in staff_credentials. Attaches req.role
// ('admin' | 'kitchen') so controllers can apply role-based rules.
const adminAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authorization header required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const result = await pool.query('SELECT role, password_hash FROM staff_credentials');

    for (const row of result.rows) {
      const match = await bcrypt.compare(token, row.password_hash);
      if (match) {
        req.role = row.role;
        return next();
      }
    }

    return res.status(403).json({ success: false, message: 'Invalid credentials' });
  } catch (err) {
    console.error('adminAuth error:', err.message);
    return res.status(500).json({ success: false, message: 'Auth check failed' });
  }
};

module.exports = adminAuth;
