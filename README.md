# Multi-Resource API with Roles & Concurrency Safety

A secure backend API for an event registration platform, built with Node.js, Express, Prisma, and PostgreSQL (Neon).

## Features

- **Role-Based Access Control (RBAC):** Admins can create events; Members can view and register.
- **Secure Authentication:** Short-lived access tokens (15 min) plus database-backed refresh tokens (7 days).
- **Relational Schema:** Users, Events, Registrations, and Refresh Tokens linked with foreign keys.
- **Pagination & Sorting:** `GET /api/events` supports `page`, `limit`, `sortBy`, and `order`.
- **Concurrency Safety:** Uses PostgreSQL row-level locking (`FOR UPDATE`) inside a transaction to prevent race conditions during event registration.
- **Automated Testing:** 3 integration tests covering Auth, RBAC, and Concurrency using Jest and Supertest.

## Tech Stack

| Layer     | Technology             |
|-----------|------------------------|
| Runtime   | Node.js                |
| Framework | Express.js             |
| Database  | PostgreSQL (Neon)      |
| ORM       | Prisma                 |
| Testing   | Jest, Supertest        |

## Database Schema

![Database Schema](event-api/db-framework.png)

| Model          | Purpose                                                                                      |
|----------------|----------------------------------------------------------------------------------------------|
| `User`         | Stores credentials and role (`ADMIN` / `MEMBER`).                                            |
| `Event`        | Stores event details and capacity.                                                           |
| `Registration` | Join table linking Users and Events, with a `@@unique([userId, eventId])` constraint.        |
| `RefreshToken` | Stores valid refresh tokens to support token rotation.                                       |

## Setup & Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/eat-nentos/<repo-name>.git
   cd <repo-name>/event-api
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the project root:

   ```env
   PORT=3000
   DATABASE_URL="your_neon_postgres_url"
   JWT_ACCESS_SECRET="your_access_secret"
   JWT_REFRESH_SECRET="your_refresh_secret"
   ```

4. Set up the database schema:

   ```bash
   npx prisma migrate dev
   ```

5. Start the server:

   ```bash
   npm run dev
   ```

## Running Automated Tests

```bash
npm test
```

## API Endpoints

| Method | Endpoint                      | Access        | Description                         |
|--------|-------------------------------|---------------|-------------------------------------|
| POST   | `/api/auth/register`          | Public        | Register a new user                 |
| POST   | `/api/auth/login`             | Public        | Log in and receive tokens           |
| POST   | `/api/auth/refresh`           | Public        | Exchange a refresh token            |
| GET    | `/api/protected`              | Authenticated | Test protected route                |
| GET    | `/api/admin-only`             | Admin         | Test admin-only route               |
| POST   | `/api/events`                 | Admin         | Create an event                     |
| GET    | `/api/events`                 | Authenticated | List events (paginated, sortable)   |
| POST   | `/api/events/:id/register`    | Authenticated | Register for an event               |

## Manual API Testing (curl)

**Prerequisite:** start the server in one terminal with `npm run dev`, and leave it running. Use a second terminal for the commands below.

### Authentication & RBAC

**1. Register an Admin**

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"password123","role":"ADMIN"}'
```

**2. Register a Member**

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"member@test.com","password":"password123","role":"MEMBER"}'
```

**3. Log in as Admin**

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"password123"}'
```

Copy the `accessToken` from the response and use it as `YOUR_ADMIN_TOKEN`.

**4. Log in as Member**

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"member@test.com","password":"password123"}'
```

Copy the `accessToken` from the response and use it as `YOUR_MEMBER_TOKEN`.

**5. Access a protected route (Admin token)**

```bash
curl http://localhost:3000/api/protected \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**6. Access an admin-only route (Admin token) — should succeed**

```bash
curl http://localhost:3000/api/admin-only \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**7. Access an admin-only route (Member token) — should fail with `403`**

```bash
curl http://localhost:3000/api/admin-only \
  -H "Authorization: Bearer YOUR_MEMBER_TOKEN"
```

### Events

**8. Create an event (Admin)**

```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"title":"Tech Conference","description":"A great event","capacity":50}'
```

Copy the `id` from the response and use it as `EVENT_ID`.

**9. Create an event as a Member — should fail with `403`**

```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_MEMBER_TOKEN" \
  -d '{"title":"Hacker Event","capacity":100}'
```

**10. List events with pagination and sorting**

```bash
curl "http://localhost:3000/api/events?page=1&limit=5&sortBy=title&order=asc" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**11. Register for an event (Member)**

```bash
curl -X POST http://localhost:3000/api/events/EVENT_ID/register \
  -H "Authorization: Bearer YOUR_MEMBER_TOKEN"
```

**12. Refresh the access token**

Copy the `refreshToken` from step 3 or 4:

```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"YOUR_REFRESH_TOKEN"}'
```

### Concurrency Test

This test shows that row-level locking prevents overbooking when many requests arrive at the same time.

**13. Create an event with capacity 1 (Admin)**

```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"title":"Last Spot","capacity":1}'
```

Copy the new `id` and use it as `EVENT_ID`.

**14. Fire 5 simultaneous registration requests (Member)**

Replace `EVENT_ID` and `YOUR_MEMBER_TOKEN`, then paste the whole block into your terminal at once:

```bash
for i in {1..5}; do
  curl -s -X POST http://localhost:3000/api/events/EVENT_ID/register \
    -H "Authorization: Bearer YOUR_MEMBER_TOKEN" &
done
wait
```

**Expected result:** exactly 1 success (`201 Created`) and 4 failures (`400 Bad Request`).
