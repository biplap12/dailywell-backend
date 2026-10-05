# DailyWell Backend

Standalone REST API for the DailyWell Android wellness app (water, sleep, habits, routines, reminders, steps, activities, Gregorian + Bikram Sambat calendar, bilingual notifications) with offline-first synchronization. A separate Next.js admin dashboard can consume the same API later; nothing here depends on a frontend.

**Stack:** Node.js · Express · TypeScript · MongoDB/Mongoose · Zod · JWT · Argon2id · Helmet · Pino · Swagger/OpenAPI · Redis-ready.

## 1. Overview

```
src/
├── app.ts / server.ts         Express app factory / bootstrap + graceful shutdown
├── config/                    env (Zod-validated), database, redis (optional)
├── common/                    errors, middleware, validators, utils, constants
├── modules/<name>/            model · schema · controller · service · repository · routes · types
│   auth users water sleep habits routines reminders steps activities
│   calendar notifications config sync health      ← mobile-facing
│   admin audit                                    ← backend foundation for a future dashboard
├── routes/index.ts            mounts everything under /api/v1
└── docs/                      OpenAPI generated from the registered routes
```

Controllers are thin; business rules live in services; all queries live in repositories or the shared owned-record helpers (`common/utils/ownedCrud.ts`).

## 2. Requirements

- Node.js ≥ 18.17 (20 LTS recommended)
- MongoDB ≥ 6 (a standalone instance is enough; no transactions are used)
- Redis (optional)
- Docker (optional)

## 3. Installation

```bash
npm install
cp .env.example .env     # then fill in the two JWT secrets
```

## 4. Environment setup

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # run twice
```

| Variable | Default | Notes |
|---|---|---|
| `NODE_ENV` | `development` | `production` enables safe error output and `trust proxy` |
| `PORT` | `5000` | |
| `API_BASE_URL` | `http://localhost:5000/api/v1` | Shown as the server URL in Swagger |
| `MONGODB_URI` | `mongodb://localhost:27017/dailywell` | |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | – (required, ≥16 chars) | Use two different values |
| `JWT_ACCESS_EXPIRES_IN` | `30m` | 15–60 minutes recommended |
| `JWT_REFRESH_EXPIRES_IN` | `30d` | 30–90 days |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allow-list for browser clients |
| `REDIS_URL` | empty | Optional |
| `LOG_LEVEL` | `info` | |
| `AUTH_RATE_LIMIT_MAX` | `5` | per minute per IP on auth routes |
| `GENERAL_RATE_LIMIT_MAX` | `300` | per minute per IP on the API |
| `SYNC_RATE_LIMIT_MAX` | `30` | per minute per IP on sync / batch routes |

The server refuses to start with missing or too-short secrets. Never commit `.env`.

## 5. MongoDB setup

Local: install MongoDB or run `docker run -d -p 27017:27017 --name dw-mongo mongo:7`. On startup the server calls `syncIndexes()`; the unique indexes (idempotency keys, one step record per day, one habit completion per habit/day, unique email) are part of the correctness model, so do not disable that in production unless you manage indexes yourself.

Collections: `users`, `water_entries`, `sleep_entries`, `habits`, `habit_completions`, `routine_items`, `reminders`, `step_records`, `activity_logs`, `calendar_events`, `notifications`, `remote_configs`, `holidays`, `refresh_tokens`, `sync_operations`, `audit_logs`.

## 6. Redis setup

Redis is optional. With `REDIS_URL` empty the API runs without it. When set (e.g. `redis://localhost:6379`) the connection is created and reported by `/health`; `config/redis.ts` is the single place future caching, distributed rate limiting (swap the store in `common/middleware/rateLimit.ts`), sessions, job queues and locks should hook into. Currently rate limiting uses the in-process store, which is correct for a single instance; use a Redis store before running multiple replicas.

## 7. Development commands

```bash
npm run dev          # tsx watch, http://localhost:5000
npm run typecheck
npm test             # full suite (needs MongoDB; see §17)
npm run test:unit    # database-free subset
npm run seed         # sample data (npm run seed -- --reset to rebuild)
```

## 8. Production commands

```bash
npm run build
NODE_ENV=production npm start
```

## 9. API documentation

- Swagger UI: `http://localhost:5000/api/docs`
- Raw spec: `http://localhost:5000/api/docs.json`

The spec is generated at startup from the routes that are actually registered, using the same Zod schemas that validate requests, so it cannot drift from behavior.

Conventions:

```jsonc
// success
{ "success": true, "message": "Operation successful", "data": {} }
// error (also carries requestId; every response has an X-Request-Id header)
{ "success": false, "message": "Validation failed", "error": { "code": "VALIDATION_ERROR", "details": {} } }
```

Lists accept `?page=1&limit=20&sort=createdAt&order=desc` (limit ≤ 100) and return `{ items, pagination: { page, limit, total, totalPages } }`.

Status codes: 200/201/204, 400 malformed, 401 unauthenticated (`TOKEN_EXPIRED`, `INVALID_TOKEN`, …), 403 forbidden, 404 not found (also for other users' records), 409 conflict, 413 too large, 422 validation, 429 rate-limited, 500.

Endpoint summary (all under `/api/v1`): `auth/{register,login,refresh,logout,profile,guest}`, `users/{me,step-goal,settings}`, `water`, `sleep`, `habits` (+`/:id/toggle`), `routines` (+`/reorder`, `/:id/complete`), `reminders`, `steps` (+`/batch`), `activities`, `calendar/events`, `notifications` (+`/:id/read`), `config`, `config/holidays`, `sync/{upload,changes,migrate-guest}`, `admin/{users,audit-logs,notifications}`. Health probes are at `/health`, `/health/live`, `/health/ready`.

## 10. Authentication flow

1. `POST /auth/register` or `/auth/login` → `{ accessToken, refreshToken, user }`.
2. Send `Authorization: Bearer <accessToken>` on private routes.
3. When the access token expires (`401` with `error.code = "TOKEN_EXPIRED"`), call `POST /auth/refresh` with the refresh token. You get a **new pair**; the old refresh token is now dead.
4. `POST /auth/logout` revokes the whole session family.

Details: passwords are hashed with Argon2id (OWASP parameters); login does the same amount of work for unknown emails and returns one generic error; refresh tokens are single-use and only their SHA-256 hash is stored. Presenting an already-used refresh token is treated as theft and revokes that whole family. Identity and role are re-read from the database on every request, so suspensions and role changes apply immediately. The role/userId in a request body is never trusted (unknown body keys are rejected).

## 11. RBAC

| Role | Permissions |
|---|---|
| `SUPER_ADMIN` | everything, including remote config and role changes |
| `ADMIN` | own data + user management (suspend/reinstate lower ranks), audit log, holidays |
| `USER` | own data + sync |
| `GUEST` | own data only; no bulk sync, no admin |

Enforced by `authenticate()`, `authorize(permission)`, `requireRole(...)`, `requireMinRole(role)` and `requirePermission(...)` (`common/middleware/auth.ts`). Roles can only be changed by a `SUPER_ADMIN` through `PUT /admin/users/:id/role`; there is no way to self-assign one. Every record is queried with the `userId` from the JWT, so another user's record returns `404` (IDOR-safe, ids cannot be probed).

## 12. Offline synchronization

The Android app queues operations while offline, then sends them to `POST /sync/upload` (up to 100 per request, processed in order, one failure never aborts the rest).

```jsonc
{
  "deviceId": "android-device-001",
  "operations": [{
    "entityType": "water",            // water|sleep|habit|habit_completion|routine|reminder|steps|activity|calendar_event
    "operation": "CREATE",            // CREATE|UPDATE|DELETE
    "localId": "local-123",           // client-generated id
    "idempotencyKey": "unique-operation-key",   // ≥ 8 chars
    "payload": { "amountMl": 250, "date": "2026-10-04", "time": "08:30" }
  }]
}
```

For `UPDATE`/`DELETE` send `entityId` (server id) or the `localId`, plus optionally `baseVersion` (the server version your edit was based on) and `clientUpdatedAt` (when the user made the change).

Response `data`: `processed`, `failed`, `conflicts`, `duplicates`, `idMappings` (`localId → serverId`), `changes` (new versions, including deletions), `conflictDetails`, and per-operation `results` with `status` `PROCESSED | DUPLICATE | CONFLICT | FAILED`.

- **Idempotency:** every operation's key is recorded in `sync_operations` (unique per user). Replaying a key returns the original result with `status: "DUPLICATE"` and changes nothing. The same `(deviceId, localId)` can also never create two rows, and concurrent retries execute once.
- **Ordering across entities:** a `habit_completion` may reference a habit created earlier in the same batch by that habit's `localId` as its `habitId`.
- **Natural keys:** a `steps` create for a day that already has a record updates that day instead of failing.
- **Deletes** are soft (tombstones with `deletedAt` and an incremented `version`) and idempotent.
- **Download:** `GET /sync/changes?since=<ISO>` returns everything changed since then (including tombstones) per entity type, with `hasMore`/`nextSince` for paging.

Each synced row carries `createdAt, updatedAt, deletedAt, version, deviceId, localId, clientId`.

## 13. Conflict resolution

A conflict exists when the client's `baseVersion` differs from the server version, or (without a base version) when another device changed the row after the client's `clientUpdatedAt`. Nothing is overwritten silently: every conflict is returned in `conflictDetails`:

```jsonc
{ "entityType": "water", "entityId": "…", "clientVersion": 1, "serverVersion": 2,
  "clientData": {…}, "serverData": {…}, "resolution": "SERVER_WINS", "strategy": "LAST_WRITE_WINS" }
```

Default strategy is `LAST_WRITE_WINS` (newer `clientUpdatedAt` wins; ties go to the server; omitting `clientUpdatedAt` counts the client's change as "now"). `conflictStrategy` can be set per request (`SERVER_WINS`, `CLIENT_WINS`), and `registerConflictResolver()` in `modules/sync/conflictResolver.ts` adds new strategies (e.g. field-level merge) without touching the engine. An update never resurrects a row deleted elsewhere (reported as a `SERVER_WINS` conflict). The plain REST `PUT` endpoints use optimistic locking: send `version` and a stale one gets `409` with the server copy.

**Guest mode:** `POST /auth/guest` creates a restricted guest account so the app can use the API pre-registration (or stay purely local). After the user registers/logs in, call `POST /sync/migrate-guest` with the guest's refresh token. The destination is always the authenticated caller; the guest is proven by its own refresh token (a bare user id is useless), only `GUEST` accounts can be migrated, and each guest migrates once. For data that only ever lived on the device, simply upload it through `/sync/upload` after login.

## 14. Android emulator configuration

The emulator reaches the host machine at `10.0.2.2`:

```
http://10.0.2.2:5000/api/v1/
```

Plain HTTP needs `android:usesCleartextTraffic="true"` (or a network security config) in debug builds only.

## 15. Physical Android device configuration

Use your computer's LAN IP (same Wi-Fi), e.g. `http://192.168.1.20:5000/api/v1/`. Find it with `ipconfig` (Windows) or `ip addr` / `ifconfig` (macOS/Linux), and allow port 5000 through the firewall. The server listens on all interfaces. Native apps send no `Origin` header, so CORS does not apply to them.

## 16. Docker deployment

```bash
export JWT_ACCESS_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
export JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
docker compose up -d --build                       # api + mongo
docker compose --profile redis up -d --build       # + redis (set REDIS_URL=redis://redis:6379)
docker compose logs -f api
```

The image is multi-stage, runs as a non-root user under `tini`, and has a healthcheck on `/health/live`. Mongo is not published to the host by default.

## 17. Testing

```bash
npm test             # everything
npm run test:unit    # unit + HTTP smoke tests that need no database
```

`npm test` starts an in-memory MongoDB via `mongodb-memory-server` (downloads a MongoDB binary on first run). Offline or behind a restrictive proxy, point it at an existing instance instead: `TEST_MONGO_URI=mongodb://localhost:27017 npm test` (each test file uses its own throwaway database, which is dropped afterward).

Coverage: auth (registration, duplicate email, login, wrong password, refresh rotation + reuse, logout, expired/forged tokens), authorization (401s, IDOR, RBAC, suspension, guest limits), every wellness module, sync (create/update/delete, idempotency, concurrent retries, conflicts, batches, guest migration), and security (NoSQL injection, prototype pollution, malformed/oversized bodies, JWT attacks, CORS, headers, rate limiting, no secret leakage).

## 18. Security

Helmet headers · strict CORS allow-list · rate limits (auth 5/min/IP; separate sync and general limits) · Zod validation of body, params, query and headers on every route (unknown body keys rejected) · NoSQL-injection guard (`$`/dotted keys rejected before validation, and every filter input is a Zod-validated primitive) · 256 KB body limit · request IDs on every response · Pino structured logs with credential redaction (path only, no query strings, headers or bodies) · sanitized errors (stack traces only outside production, never for client errors) · Argon2id · short-lived access tokens + rotating refresh tokens with reuse detection · identity only from the JWT · audit log of auth, admin and config actions.

## 19. Production deployment

- Run behind a TLS-terminating reverse proxy/load balancer (`trust proxy` is set to 1 in production so rate limits see the real client IP; adjust if you have more hops).
- Use managed MongoDB (Atlas or a replica set) with auth, TLS and backups; set `MONGODB_URI` accordingly.
- Provide strong, distinct JWT secrets via your secret manager; rotate by deploying new values (users will simply log in again).
- Set `CORS_ORIGINS` to your real dashboard origin(s) and `API_BASE_URL` to `https://api.dailywell.app/api/v1`.
- Scale horizontally only after switching rate limiting to a Redis store.
- Probes: liveness `/health/live`, readiness `/health/ready` (returns 503 when the database is down).
- Seed script refuses to run with `NODE_ENV=production`. Create the first `SUPER_ADMIN` by registering normally and promoting that user directly in MongoDB (`db.users.updateOne({email:"you@…"},{$set:{role:"SUPER_ADMIN"}})`).
- Versioning: v1 is mounted in `app.ts` via `createV1Router()`; add `/api/v2` next to it without touching v1.

## Notes and limits

- Nepali (BS) dates are stored and queryable but not converted to or from Gregorian by the server; clients send both.
- `isRead`, notifications and holidays are not part of sync; notifications are server-authored, hard-deleted on request.
- Admin features included are only those the backend needs (user suspension, role changes, audit log, config and holiday management, sending notifications); there is no dashboard.
