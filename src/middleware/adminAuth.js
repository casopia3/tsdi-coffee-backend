const adminAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authorization header required' });
  }

  const token = authHeader.split(' ')[1];
  const adminPw   = process.env.ADMIN_PASSWORD;
  const kitchenPw = process.env.KITCHEN_PASSWORD;

  if (token !== adminPw && token !== kitchenPw) {
    return res.status(403).json({ success: false, message: 'Invalid credentials' });
  }

  // Attach role to request so controllers can check if needed
  req.role = token === adminPw ? 'admin' : 'kitchen';
  next();
};

module.exports = adminAuth;