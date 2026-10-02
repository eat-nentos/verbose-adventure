import express from 'express';
import * as eventController from '../controllers/eventController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

// POST /api/events - Only Admins can create events
router.post('/', authenticateToken, authorize('ADMIN'), eventController.createEvent);

// GET /api/events - Any logged-in user can view events
router.get('/', authenticateToken, eventController.getEvents);

// POST /api/events/:id/register - Any logged-in user can register
router.post('/:id/register', authenticateToken, eventController.registerForEvent);

export default router;