import prisma from '../prisma.js';

export const createEvent = async (title, description, capacity, creatorId) => {
  return await prisma.event.create({
    data: {
      title,
      description,
      capacity,
      creatorId,
    },
  });
};

export const getEvents = async (page = 1, limit = 10, sortBy = 'createdAt', order = 'desc') => {
  // 1. Calculate how many records to skip based on the page number
  const skip = (page - 1) * limit;

  // 2. Fetch the events with pagination and sorting
  const events = await prisma.event.findMany({
    skip: skip,
    take: parseInt(limit),
    orderBy: {
      [sortBy]: order, // e.g., { createdAt: 'desc' }
    },
    include: {
      creator: {
        select: { email: true } // Only return the creator's email, not their password!
      },
      _count: {
        select: { registrations: true } // Tells us how many people registered
      }
    }
  });

  // 3. Get the total count to calculate total pages
  const totalEvents = await prisma.event.count();

  return {
    data: events,
    meta: {
      total: totalEvents,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(totalEvents / limit),
    }
  };
};

export const registerForEvent = async (userId, eventId) => {
  // We use prisma.$transaction to ensure all or nothing happens
  return await prisma.$transaction(async (tx) => {
    
    // 1. THE MAGIC: Lock the event row using raw SQL
    // "FOR UPDATE" tells PostgreSQL to block other transactions from touching this row
    const events = await tx.$queryRaw`
      SELECT id, capacity FROM "Event" WHERE id = ${eventId} FOR UPDATE
    `;
    
    const event = events[0];
    if (!event) throw new Error('Event not found');

    // 2. Now that the row is locked, safely count the registrations
    const currentRegistrations = await tx.registration.count({
      where: { eventId: eventId }
    });

    // 3. Check the capacity. Because of the lock, this is 100% accurate.
    if (currentRegistrations >= event.capacity) {
      throw new Error('Event is at full capacity');
    }

    // 4. Create the registration. 
    // The @@unique([userId, eventId]) rule will throw an error if they try to register twice.
    try {
      const registration = await tx.registration.create({
        data: { userId, eventId }
      });
      return registration;
    } catch (error) {
      if (error.code === 'P2002') { // Prisma's unique constraint error code
        throw new Error('You are already registered for this event');
      }
      throw error;
    }
  });
};