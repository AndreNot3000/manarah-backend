# MANARAH Backend

Node.js + Express API for the MANARAH platform.

## Setup

```bash
npm install
cp .env.example .env
npm run db:up          # starts PostgreSQL via Docker
npm run db:migrate     # run Prisma migrations
npm run db:seed        # seed admin user
npm run dev
```

Server runs at **http://localhost:4000**.

## Database

| Command | Description |
|---|---|
| `npm run db:up` | Start PostgreSQL (Docker) |
| `npm run db:down` | Stop PostgreSQL |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed admin user |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:generate` | Regenerate Prisma client |

**Seed admin:** `admin@manarah.com` / `Admin@123`

> **Database:** Uses local PostgreSQL on port `5432` by default (`postgres:postgres`).  
> Docker Compose is optional if you already have PostgreSQL installed. Update `DATABASE_URL` in `.env` to match your credentials.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run production build |

## API

> **Frontend handoff:** See **[../docs/API_REFERENCE.md](../docs/API_REFERENCE.md)** for full request/response documentation, enums, error codes, and FE task card mapping.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Health check — returns `{ "status": "ok" }` |
| POST | `/api/auth/register/student` | Register student — returns `{ token, user }` |
| POST | `/api/auth/register/tutor` | Register tutor (PENDING profile) — returns `{ token, user }` |
| POST | `/api/auth/login` | Login — `{ email, password }` → `{ token, user }` |
| POST | `/api/auth/forgot-password` | Request password reset (MVP: logs token in dev) |
| POST | `/api/auth/reset-password` | Reset password — `{ token, newPassword }` |
| GET | `/api/users/me` | Full profile for current user (role-specific) |
| PATCH | `/api/users/me` | Update profile — JSON or `multipart/form-data` with `avatar` |
| GET | `/api/students/saved-tutors` | List saved tutors (student only) |
| POST | `/api/students/saved-tutors/:tutorId` | Save tutor (idempotent) |
| DELETE | `/api/students/saved-tutors/:tutorId` | Unsave tutor |
| GET | `/api/notifications` | List notifications (`?page=&limit=&unreadOnly=true`) |
| PATCH | `/api/notifications/:id/read` | Mark notification as read |
| GET | `/api/tutors` | Public tutor listing (`?subject=&q=&page=&limit=`) |
| GET | `/api/tutors/:id` | Public tutor detail |
| GET | `/api/tutors/me` | Tutor's own full profile (tutor only) |
| PATCH | `/api/tutors/me` | Update tutor profile — JSON or `multipart/form-data` |
| POST | `/api/tutors/inquiries` | Send inquiry to tutor (`{ tutorId, message }`, student only) |
| GET | `/api/tutors/me/inquiries` | Tutor inquiry inbox (`?page=&limit=`) |

**`PATCH /api/tutors/me` fields**

| Field | Type | Notes |
|---|---|---|
| `bio` | string | Max 2000 chars |
| `pricing` | string/number | e.g. `"60.50"` |
| `experience` | string | Max 500 chars |
| `availability` | string | Max 500 chars |
| `subjects` | `TutorSubjectType[]` | Replaces entire subject list |
| `removeQualificationIds` | string[] | Remove owned qualifications |
| `photo` | file (multipart) | JPEG/PNG/WebP/GIF, max 5MB |
| `qualifications` | files (multipart) | PDF/JPEG/PNG/WebP, max 10MB each |
| `qualificationTitles` | JSON string (multipart) | Must match `qualifications` file count |

> **Public tutor policy:** Only `VERIFIED` and `PREMIUM` tutors appear on public endpoints. `PENDING` tutors are hidden until admin verification (BE-051).
| GET | `/api/auth/admin/check` | Admin-only route (403 if wrong role) |

**Registration & login** return `{ token, user: { id, email, role, name } }` so the client can log in immediately after sign-up.

## Auth security

| Feature | Implementation |
|---|---|
| Password hashing | bcrypt (10 rounds) — never stored plain text |
| JWT auth | Bearer token with expiry (`JWT_EXPIRES_IN`) |
| DB user check | Every protected request verifies user still exists |
| Stale token rejection | Invalid if email/role changed in DB |
| Rate limiting | Login, register, password reset (per IP) |
| Security headers | Helmet.js |
| RBAC | `requireRole("student" \| "tutor" \| "admin")` → 403 |

Full manual test checklist: [docs/AUTH_TEST_CHECKLIST.md](./docs/AUTH_TEST_CHECKLIST.md)

## Auth utilities

| Module | Path | Purpose |
|---|---|---|
| JWT helpers | `src/utils/jwt.ts` | `signToken`, `verifyToken` |
| Password helpers | `src/utils/password.ts` | `hashPassword`, `comparePassword` |
| Middleware | `src/middleware/authenticate.ts` | Validates Bearer token → 401 |
| Middleware | `src/middleware/requireRole.ts` | Role guard → 403 |

## Environment

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | Server port |
| `FRONTEND_URL` | `http://localhost:3000` | CORS allowed origin |
| `DATABASE_URL` | see `.env.example` | PostgreSQL connection string |
| `JWT_SECRET` | — | Secret for signing JWTs (required) |
| `JWT_EXPIRES_IN` | `7d` | Token expiry |
| `PUBLIC_URL` | `http://localhost:4000` | Base URL for uploaded files |
| `AUTH_RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (15 min) |
| `AUTH_LOGIN_RATE_LIMIT_MAX` | `10` | Max login attempts per window |
| `AUTH_REGISTER_RATE_LIMIT_MAX` | `5` | Max register attempts per window |
| `AUTH_RESET_RATE_LIMIT_MAX` | `5` | Max password reset attempts per window |
