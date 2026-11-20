# Security hardening + project scaffolding

Addresses a security review's high-priority items and the two setup gaps
it flagged (missing `.env.example` despite the README referencing it, no
CI despite the README claiming one).

## 1. Rate limiting on auth

- `apps/api/src/app.module.ts` — `ThrottlerGuard` is now registered once,
  globally, via `APP_GUARD`, instead of being attached per-controller.
  The existing `ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])`
  config is now the default that applies to every route.
- `apps/api/src/auth/auth.controller.ts` — `register`, `login`,
  `forgot-password` and `reset-password` each override the default with
  `@Throttle({ default: { limit: 5, ttl: 60_000 } })` (5 req/min per IP).
- High-traffic public read routes are exempted with `@SkipThrottle()`
  rather than sharing a budget with sensitive routes: `GET /discover/home`,
  `GET /songs`, `GET /songs/:idOrSlug`, `GET /albums`, `GET
  /albums/:idOrSlug`, `GET /artists`, `GET /artists/:idOrSlug`, `GET
  /genres`, `GET /genres/:idOrSlug`.
- `apps/api/src/search/search.controller.ts` — removed the now-redundant
  local `@UseGuards(ThrottlerGuard)` (the guard is global now); kept its
  own tighter `@Throttle({ default: { limit: 20, ttl: 10_000 } })`
  override for the debounced search-as-you-type endpoint.

## 2. Temporary account lockout on repeated failed logins

`apps/api/src/auth/auth.service.ts` — independent of the per-IP throttle
above (which a distributed attacker can spread across many IPs), `login`
now tracks failed attempts **per account** in Redis:

- `auth:login-fails:<email>` — incremented on every bad password /
  unknown email, TTL 15 min from the first failure.
- `auth:login-lock:<email>` — set once failed attempts reach 5; while
  set, `login` short-circuits with 401 before touching Postgres.
- A successful login clears both keys.
- Both keys expire on their own — no unlock endpoint needed, no DB row
  added.

New `CacheService.increment()` (`apps/api/src/redis/cache.service.ts`)
backs this: atomic Redis `INCR`, TTL set only on the first increment,
fails open (returns 0, never blocks the caller) if Redis is unavailable.

## 3. Ban/role cache — avoid a DB hit on every authenticated request

`apps/api/src/auth/strategies/jwt.strategy.ts` — `validate()` used to run
a `prisma.user.findUnique` on *every* authenticated request just to check
`deletedAt`. It now caches `{ banned, email, username, role }` in Redis
under `auth:user-status:<userId>` for 45s (`USER_STATUS_CACHE_TTL_SECONDS`,
within the 30–60s target) and only falls back to Postgres on a cache miss.

Because a stale cache could otherwise let a just-banned user stay
authorized for up to the TTL, `apps/api/src/admin/admin.service.ts`
(`banUser`, `unbanUser`, and `updateRole` — role is cached too) now
deletes that same key immediately after the DB write, so a ban (or role
change) takes effect on the account's very next request rather than
waiting out the cache.

## 4. `.env.example`

Added at the repo root. `README.md` already told people to
`cp .env.example .env` and pointed at it for the full list of variables,
but the file didn't exist. Values mirror what `docker-compose.yml`
already defaults to (Postgres, Redis, JWT, MinIO/S3 storage, mail, VAPID
push keys, app/CORS URLs).

## 5. CI

Added `.github/workflows/ci.yml` (README referenced CI; none existed).
Runs on push/PR against ephemeral Postgres + Redis service containers:
install → `prisma generate` → `prisma migrate deploy` → lint → typecheck
→ unit tests → e2e tests → build, across all workspaces.

## 6. Repo cleanup

Moved the orphaned `phase6-search-preview.html` from the monorepo root
into `docs/previews/phase6-search-preview.html` — nothing referenced it
by its old path.

## Tests touched

- `apps/api/src/auth/auth.service.spec.ts` — added a `CacheService` mock
  (and a `NotificationsService` mock it was missing already) plus new
  cases for the lockout: rejects immediately while locked without
  touching the DB, sets the lock at the threshold, clears strikes on
  success.
- `apps/api/src/admin/admin.service.spec.ts` — added a `CacheService`
  mock and a case asserting `banUser` evicts the cached auth status.
- Verified against all `apps/api/test/*.e2e-spec.ts`: each spec's
  login/register call count (2–3 per file) stays well under the new 5/min
  throttle, and each e2e spec boots its own Nest app instance so the
  in-memory throttler storage isn't shared across files.
