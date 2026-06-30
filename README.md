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

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Health check — returns `{ "status": "ok" }` |
| GET | `/api/auth/me` | Current user from JWT (requires `Authorization: Bearer <token>`) |
| GET | `/api/auth/admin/check` | Admin-only route (403 if wrong role) |
| POST | `/api/auth/dev/token` | Dev only — generate a test JWT |

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
