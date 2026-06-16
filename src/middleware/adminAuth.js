// Simple admin authentication middleware
// Used to protect kitchen dashboard and menu management routes
// For production you'd replace this with proper JWT auth

const adminAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authorization header required' });
  }

  const token = authHeader.split(' ')[1];

  if (token !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ success: false, message: 'Invalid admin credentials' });
  }

  next();
};

module.exports = adminAuth;
