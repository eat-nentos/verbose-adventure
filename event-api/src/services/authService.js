import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma.js';

// Helper to generate tokens
const generateTokens = (userId, role) => {
  const accessToken = jwt.sign(
    { userId, role }, 
    process.env.JWT_ACCESS_SECRET, 
    { expiresIn: '15m' } // Short-lived
  );
  
  const refreshToken = jwt.sign(
    { userId }, 
    process.env.JWT_REFRESH_SECRET, 
    { expiresIn: '7d' } // Long-lived
  );
  
  return { accessToken, refreshToken };
};

export const registerUser = async (email, password, role = 'MEMBER') => {
  // 1. Check if user already exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error('User already exists');
  }

  // 2. Hash the password (never store plain text!)
  const hashedPassword = await bcrypt.hash(password, 10);

  // 3. Create the user in the database
  const user = await prisma.user.create({
    data: { email, password: hashedPassword, role },
  });

  return { id: user.id, email: user.email, role: user.role };
};

export const loginUser = async (email, password) => {
  // 1. Find the user
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error('Invalid credentials');
  }

  // 2. Check if password is correct
  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    throw new Error('Invalid credentials');
  }

  // 3. Generate tokens
  const { accessToken, refreshToken } = generateTokens(user.id, user.role);

  // 4. Save the Refresh Token to the database so we can invalidate it later
  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    },
  });

  return { accessToken, refreshToken, user: { id: user.id, email: user.email, role: user.role } };
};
export const refreshAccessToken = async (refreshToken) => {
  // 1. Verify the refresh token is valid
  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  
  // 2. Check if it exists in our database (meaning it hasn't been revoked)
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: refreshToken }
  });

  if (!storedToken || storedToken.expiresAt < new Date()) {
    throw new Error('Invalid or expired refresh token');
  }

  // 3. Get the user to generate a new token with their current role
  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  if (!user) throw new Error('User not found');

  // 4. Generate a new access token
  const newAccessToken = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );

  return { accessToken: newAccessToken };
};