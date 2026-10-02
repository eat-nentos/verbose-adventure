import request from 'supertest';
import app from '../app.js';
import prisma from '../prisma.js';

// We use unique emails so tests don't conflict with existing data
const adminEmail = `admin-${Date.now()}@test.com`;
const memberEmail = `member-${Date.now()}@test.com`;
const password = 'password123';

let adminToken;
let memberToken;
let eventId;

// Disconnect from the database after all tests finish
afterAll(async () => {
  await prisma.$disconnect();
});

describe('API Real Logic Tests', () => {

  // Test 1: Authentication (Register & Login)
  it('should register an admin, a member, and return valid tokens upon login', async () => {
    // Register Admin
    await request(app).post('/api/auth/register').send({
      email: adminEmail, password, role: 'ADMIN'
    });
    
    // Register Member
    await request(app).post('/api/auth/register').send({
      email: memberEmail, password, role: 'MEMBER'
    });

    // Login Admin
    const adminRes = await request(app).post('/api/auth/login').send({
      email: adminEmail, password
    });
    expect(adminRes.statusCode).toBe(200);
    expect(adminRes.body).toHaveProperty('accessToken');
    adminToken = adminRes.body.accessToken;

    // Login Member
    const memberRes = await request(app).post('/api/auth/login').send({
      email: memberEmail, password
    });
    expect(memberRes.statusCode).toBe(200);
    memberToken = memberRes.body.accessToken;
  });

  // Test 2: Role-Based Access Control (RBAC)
  it('should block a MEMBER from creating an event, but allow an ADMIN', async () => {
    // Member tries to create an event (Should Fail with 403)
    const memberRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ title: 'Hacker Event', capacity: 10 });
    
    expect(memberRes.statusCode).toBe(403);
    expect(memberRes.body.error).toContain('Requires one of these roles: ADMIN');

    // Admin creates an event (Should Succeed with 201)
    const adminRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Legit Event', capacity: 1 }); // Capacity is 1 for the next test
    
    expect(adminRes.statusCode).toBe(201);
    eventId = adminRes.body.event.id;
  });

  // Test 3: Concurrency Safety (The Killer Test)
  it('should prevent race conditions and only allow 1 registration for a capacity of 1', async () => {
    // We fire 3 simultaneous registration requests for an event with capacity 1
    const promises = [
      request(app).post(`/api/events/${eventId}/register`).set('Authorization', `Bearer ${memberToken}`),
      request(app).post(`/api/events/${eventId}/register`).set('Authorization', `Bearer ${memberToken}`),
      request(app).post(`/api/events/${eventId}/register`).set('Authorization', `Bearer ${memberToken}`)
    ];

    const results = await Promise.all(promises);
    
    // Count how many succeeded (201) and how many failed (400)
    const successes = results.filter(r => r.statusCode === 201).length;
    const failures = results.filter(r => r.statusCode === 400).length;

    // Exactly 1 should succeed, 2 should fail
    expect(successes).toBe(1);
    expect(failures).toBe(2);
    
    // Verify the failure message is about capacity
    const failureMessage = results.find(r => r.statusCode === 400).body.error;
    expect(failureMessage).toMatch(/capacity|already registered/i);
  });

});