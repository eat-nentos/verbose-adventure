# Multi-Resource API with Roles & Concurrency Safety

A secure backend API for an event registration platform. Built with Node.js, Express, Prisma, and PostgreSQL (Neon).

## 🚀 Features
- **Role-Based Access Control (RBAC):** Admins can create events; Members can view and register.
- **Secure Authentication:** Short-lived Access Tokens (15m) + database-backed Refresh Tokens (7d).
- **Relational Schema:** Users, Events, Registrations, and Refresh Tokens using Foreign Keys.
- **Pagination & Sorting:** `GET /api/events` supports `page`, `limit`, `sortBy`, and `order`.
- **Concurrency Safety:** Utilizes PostgreSQL row-level locking (`FOR UPDATE`) inside a transaction to prevent race conditions during event registration.
- **Automated Testing:** 3 integration tests covering Auth, RBAC, and Concurrency using Jest & Supertest.

## 🛠️ Tech Stack
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** PostgreSQL (hosted on Neon)
- **ORM:** Prisma
- **Testing:** Jest, Supertest

## 🗄️ Database Schema
![Database Scheme](db-framework.png)

- **User:** Stores credentials and role (ADMIN/MEMBER).
- **Event:** Stores event details and capacity.
- **Registration:** Join table linking Users and Events. Has a `@@unique([userId, eventId])` constraint.
- **RefreshToken:** Stores valid refresh tokens for token rotation.

## ⚙️ Setup & Installation
1. Clone the repository.
2. Install dependencies: `npm install`
3. Create a `.env` file in the root directory and add:
   ```env
   PORT=3000
   DATABASE_URL="your_neon_postgres_url"
   JWT_ACCESS_SECRET="your_access_secret"
   JWT_REFRESH_SECRET="your_refresh_secret"

## Manual API Testing (Curl Commands)
Prerequisite: Start the Server

**Open a terminal and run:**
'''
npm run dev
'''

(Leave this terminal running. Open a second terminal for the following curl commands).

**Authentication & RBAC Testing**

1. Register an Admin:
'''
curl -X POST http://localhost:3000/api/auth/register \
-H "Content-Type: application/json" \
-d '{"email":"admin@test.com","password":"password123","role":"ADMIN"}'
'''
2. Register a Member:

'''
curl -X POST http://localhost:3000/api/auth/register \
-H "Content-Type: application/json" \
-d '{"email":"member@test.com","password":"password123","role":"MEMBER"}'
'''
3. Login as Admin (Get Access Token):

'''
curl -X POST http://localhost:3000/api/auth/login \
-H "Content-Type: application/json" \
-d '{"email":"admin@test.com","password":"password123"}'
'''
Action: Copy the accessToken from the response. Call it YOUR_ADMIN_TOKEN.

4. Login as Member (Get Access Token):

'''
curl -X POST http://localhost:3000/api/auth/login \
-H "Content-Type: application/json" \
-d '{"email":"member@test.com","password":"password123"}'
'''
Action: Copy the accessToken from the response. Call it YOUR_MEMBER_TOKEN.

5. Test Protected Route (With Admin Token):

'''
curl http://localhost:3000/api/protected \
-H "Authorization: Bearer YOUR_ADMIN_TOKEN"
'''

6. Test Admin-Only Route (With Admin Token - Should Succeed):

'''
curl http://localhost:3000/api/admin-only \
-H "Authorization: Bearer YOUR_ADMIN_TOKEN"
'''
7. Test Admin-Only Route (With Member Token - Should Fail with 403):
bash
'''
curl http://localhost:3000/api/admin-only \
-H "Authorization: Bearer YOUR_MEMBER_TOKEN"
'''

**Event & Concurrency Testing**

8. Create an Event (As Admin):

'''
curl -X POST http://localhost:3000/api/events \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
-d '{"title":"Tech Conference","description":"A great event","capacity":50}'
'''
Action: Copy the id of the event from the response. Call it EVENT_ID.

9. Try to Create an Event as a Member (Should Fail with 403):

'''
curl -X POST http://localhost:3000/api/events \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_MEMBER_TOKEN" \
-d '{"title":"Hacker Event","capacity":100}'
'''

10. List Events (With Pagination & Sorting):

'''
curl "http://localhost:3000/api/events?page=1&limit=5&sortBy=title&order=asc" \
-H "Authorization: Bearer YOUR_ADMIN_TOKEN"
'''

11. Register for an Event (As Member):

'''
curl -X POST http://localhost:3000/api/events/EVENT_ID/register \
-H "Authorization: Bearer YOUR_MEMBER_TOKEN"
'''
12. Test Refresh Token Flow:
(Copy the refreshToken from Step 3 or Step 4)

'''
curl -X POST http://localhost:3000/api/auth/refresh \
-H "Content-Type: application/json" \
-d '{"refreshToken":"YOUR_REFRESH_TOKEN"}'
'''

**🔥 The Ultimate Concurrency Test**

13. Create an Event with Capacity 1 (As Admin):
bash
'''
curl -X POST http://localhost:3000/api/events \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
-d '{"title":"Last Spot","capacity":1}'
'''
Action: Copy the new EVENT_ID.

14. Fire 5 Simultaneous Registration Requests (As Member):
(Replace EVENT_ID and YOUR_MEMBER_TOKEN below. Paste the entire block into your terminal at once).
bash
'''
for i in {1..5}; do
  curl -s -X POST http://localhost:3000/api/events/EVENT_ID/register \
  -H "Authorization: Bearer YOUR_MEMBER_TOKEN" &
done
wait
'''
Expected Result: Exactly 1 success (201 Created) and 4 failures (400 Bad Request with "Event is at full capacity").
