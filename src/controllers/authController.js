const pool = require('../db/pool');
const bcrypt = require('bcrypt');

// POST /api/auth/login
// Body: { password }
// Returns: { role: 'admin' | 'kitchen' }
// The returned role + the original password are what the frontend stores
// in sessionStorage and sends back as the Bearer token on later requests.
const login = async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ success: false, message: 'Password is required' });
  }

  try {
    const result = await pool.query('SELECT role, password_hash FROM staff_credentials');

    for (const row of result.rows) {
      const match = await bcrypt.compare(password, row.password_hash);
      if (match) {
        return res.json({ success: true, data: { role: row.role } });
      }
    }

    return res.status(401).json({ success: false, message: 'Invalid password' });
  } catch (err) {
    console.error('login error:', err.message);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};

// PATCH /api/auth/change-password
// Header: Authorization: Bearer <current password>  (verified by adminAuth)
// Body: { targetRole: 'admin' | 'kitchen', newPassword }
//
// Rule enforced here (not just in the UI):
//   - admin can change admin's own password AND kitchen's password
//   - kitchen can only change kitchen's own password
const changePassword = async (req, res) => {
  const { targetRole, newPassword } = req.body;
  const requesterRole = req.role; // set by adminAuth middleware

  if (!targetRole || !newPassword) {
    return res.status(400).json({ success: false, message: 'targetRole and newPassword are required' });
  }
  if (!['admin', 'kitchen'].includes(targetRole)) {
    return res.status(400).json({ success: false, message: 'targetRole must be admin or kitchen' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
  }

  // Permission check: kitchen can only change its own password
  if (requesterRole === 'kitchen' && targetRole !== 'kitchen') {
    return res.status(403).json({ success: false, message: 'Kitchen staff can only change their own password' });
  }

  try {
    const newHash = await bcrypt.hash(newPassword, 10);
    const result = await pool.query(
      `UPDATE staff_credentials SET password_hash = $1, updated_at = NOW()
       WHERE role = $2 RETURNING role, updated_at`,
      [newHash, targetRole]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    res.json({ success: true, data: { role: targetRole, updated_at: result.rows[0].updated_at } });
  } catch (err) {
    console.error('changePassword error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
};

module.exports = { login, changePassword };
