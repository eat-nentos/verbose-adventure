import express from 'express';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import { authenticateToken } from './middleware/authMiddleware.js';
import { authorize } from './middleware/roleMiddleware.js';

dotenv.config();

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);

// Protected test routes
app.get('/api/protected', authenticateToken, (req, res) => {
  res.json({ message: `Hello user ${req.user.userId}. You are logged in!`, role: req.user.role });
});

app.get('/api/admin-only', authenticateToken, authorize('ADMIN'), (req, res) => {
  res.json({ message: 'Welcome, Admin. You have access to the secret vault.' });
});

export default app;