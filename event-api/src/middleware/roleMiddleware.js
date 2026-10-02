export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    // req.user was set by authenticateToken
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Access denied. Requires one of these roles: ${allowedRoles.join(', ')}` 
      });
    }
    next(); // User has the right role, let them through
  };
};