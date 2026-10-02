import * as eventService from '../services/eventService.js';

export const createEvent = async (req, res) => {
  try {
    const { title, description, capacity } = req.body;
    // req.user.userId comes from our authenticateToken middleware!
    const creatorId = req.user.userId; 

    if (!title || !capacity) {
      return res.status(400).json({ error: 'Title and capacity are required' });
    }

    const event = await eventService.createEvent(title, description, capacity, creatorId);
    res.status(201).json({ message: 'Event created successfully', event });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getEvents = async (req, res) => {
  try {
    // Extract query parameters from the URL (e.g., ?page=2&limit=5)
    const { page, limit, sortBy, order } = req.query;
    
    const result = await eventService.getEvents(page, limit, sortBy, order);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const registerForEvent = async (req, res) => {
  try {
    const userId = req.user.userId; // From our auth middleware
    const eventId = req.params.id;   // From the URL (e.g., /events/123/register)

    const registration = await eventService.registerForEvent(userId, eventId);
    
    res.status(201).json({ 
      message: 'Successfully registered for event', 
      registration 
    });
  } catch (error) {
    // If capacity is full or they are already registered, send a 400 error
    res.status(400).json({ error: error.message });
  }
};