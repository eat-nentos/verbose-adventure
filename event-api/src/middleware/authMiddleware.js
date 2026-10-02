import jwt from 'jsonwebtoken';

export const authenticateToken = (req, res, next) => {
  // 1. Get the token from the Authorization header
  // Format expected: "Bearer eyJhbGciOiJIUzI1..."
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Gets the part after "Bearer "

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    // 2. Verify the token using our secret
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    
    // 3. Attach the user data (id, role) to the request object
    req.user = decoded; 
    
    // 4. Let them pass to the next function (the controller)
    next(); 
  } catch (error) {
    // This catches expired tokens or fake tokens
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
};