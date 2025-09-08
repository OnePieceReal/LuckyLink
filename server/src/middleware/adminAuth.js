const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

// middleware that blocks access to admin endpoints
// currently blocks all access since admin functionality is not implemented
function requireAdmin(req, res, next) {
  // block all access to admin endpoints for now
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    
    // In a real implementation, you would check:
    // 1. If user exists in an admin table
    // 2. Or if user has admin role in database
    // For now, we block all access since admin functionality is not implemented
    
    // Placeholder check - would query admin table in real implementation
    // const isAdmin = await checkAdminTable(decoded.userId);
    
    // Since we don't have admin users configured, always deny access
    return res.status(403).json({ 
      error: 'Access denied. Admin privileges required.',
      message: 'Admin endpoints are not available at this time.'
    });
    
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = requireAdmin;