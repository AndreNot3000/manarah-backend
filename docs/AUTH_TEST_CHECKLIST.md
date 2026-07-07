# MANARAH Backend — Auth Test Checklist

Run these tests against `http://localhost:4000` before each release or after auth changes.

**Prerequisites**
- Server running: `npm run dev`
- Database migrated and seeded: `npm run db:migrate && npm run db:seed`
- Default admin: `admin@manarah.com` / `Admin@123`

**Automated run:** `npm run test:auth` (runs all tests below automatically)

---

## 1. Registration

| # | Test | Request | Expected |
|---|---|---|---|
| 1.1 | Student register | `POST /api/auth/register/student` `{ email, password, name, phone? }` | **201** + `{ token, user }` with `role: STUDENT` |
| 1.2 | Tutor register | `POST /api/auth/register/tutor` `{ email, password, name }` | **201** + `{ token, user }` with `role: TUTOR` |
| 1.3 | Duplicate email | Repeat 1.1 with same email | **409** `EMAIL_EXISTS` |
| 1.4 | Weak password | Password under 8 chars | **400** validation error |
| 1.5 | Invalid email | Bad email format | **400** validation error |

```bash
curl -X POST http://localhost:4000/api/auth/register/student \
  -H "Content-Type: application/json" \
  -d '{"email":"student@test.com","password":"TestPass123","name":"Test Student"}'
```

---

## 2. Login

| # | Test | Request | Expected |
|---|---|---|---|
| 2.1 | Valid login | `POST /api/auth/login` `{ email, password }` | **200** + `{ token, user }` |
| 2.2 | Wrong password | Wrong password for valid email | **401** `INVALID_CREDENTIALS` |
| 2.3 | Unknown email | Non-existent email | **401** `INVALID_CREDENTIALS` (same message as 2.2) |
| 2.4 | Admin login | `admin@manarah.com` / `Admin@123` | **200** + `role: ADMIN` |

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student@test.com","password":"TestPass123"}'
```

---

## 3. JWT & protected routes

| # | Test | Request | Expected |
|---|---|---|---|
| 3.1 | No token | `GET /api/users/me` without header | **401** `UNAUTHORIZED` |
| 3.2 | Invalid token | `Authorization: Bearer invalid` | **401** `INVALID_TOKEN` |
| 3.3 | Valid token | `GET /api/users/me` with Bearer token | **200** role-specific profile |
| 3.4 | Auth me | `GET /api/auth/me` with Bearer token | **200** `{ user: { userId, email, role } }` |

```bash
curl http://localhost:4000/api/users/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 4. Role-based access control

| # | Test | Request | Expected |
|---|---|---|---|
| 4.1 | Student → admin route | Student token → `GET /api/auth/admin/check` | **403** `Forbidden` |
| 4.2 | Admin → admin route | Admin token → `GET /api/auth/admin/check` | **200** `{ ok: true }` |
| 4.3 | Tutor → admin route | Tutor token → `GET /api/auth/admin/check` | **403** `Forbidden` |

---

## 5. Password reset

| # | Test | Request | Expected |
|---|---|---|---|
| 5.1 | Forgot password | `POST /api/auth/forgot-password` `{ email }` | **200** generic success message |
| 5.2 | Reset token (dev) | Check server console for `[password-reset] token=...` | Token logged in dev only |
| 5.3 | Reset password | `POST /api/auth/reset-password` `{ token, newPassword }` | **200** success |
| 5.4 | Login with new password | Login after reset | **200** |
| 5.5 | Invalid reset token | Bad or expired token | **400** `INVALID_RESET_TOKEN` |

---

## 6. Password encryption (manual DB check)

| # | Test | How | Expected |
|---|---|---|---|
| 6.1 | Hash stored | `npm run db:studio` → User table | `passwordHash` is bcrypt hash (`$2b$10$...`), never plain text |
| 6.2 | Register hash | Register new user, inspect DB | New `passwordHash` differs from password |

---

## 7. Rate limiting

| # | Test | Request | Expected |
|---|---|---|---|
| 7.1 | Login brute force | Send 11+ failed logins from same IP within 15 min | **429** `RATE_LIMITED` |
| 7.2 | Register spam | Send 6+ register requests within 15 min | **429** `RATE_LIMITED` |

---

## 8. Stale / revoked tokens

| # | Test | How | Expected |
|---|---|---|---|
| 8.1 | Deleted user | Delete user in Prisma Studio, use old token | **401** `USER_NOT_FOUND` |
| 8.2 | Role change | Change user role in DB, use old token | **401** `TOKEN_STALE` |

---

## 9. Security hardening checklist

- [ ] `JWT_SECRET` is set and strong in production (not default dev value)
- [ ] `.env` is not committed to git
- [ ] `NODE_ENV=production` in production (disables dev-only features)
- [ ] `FRONTEND_URL` matches actual frontend origin (CORS)
- [ ] `PUBLIC_URL` set to production API URL
- [ ] HTTPS enabled in production
- [ ] Admin seed password changed after first deploy

---

## Quick smoke test (all pass = auth OK)

```bash
# 1. Register
curl -s -X POST http://localhost:4000/api/auth/register/student \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke@test.com","password":"TestPass123","name":"Smoke Test"}'

# 2. Login (save token from response)
curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke@test.com","password":"TestPass123"}'

# 3. Profile
curl -s http://localhost:4000/api/users/me \
  -H "Authorization: Bearer TOKEN"

# 4. Admin login
curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@manarah.com","password":"Admin@123"}'
```

---

*Last updated: July 2026*
