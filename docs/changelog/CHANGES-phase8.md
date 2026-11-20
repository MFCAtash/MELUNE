# Phase 8 — Backend completeness: Redis caching, real storage, notifications, e2e coverage

This phase closes four of the gaps called out in the project audit
(`نواقص بک‌اند`). AI/Recommendation and an admin frontend panel were
explicitly deferred — see "Not included" at the bottom.

## Redis: from unused infrastructure to a real cache
- `src/redis/` — `RedisModule` (global) provides an `ioredis` client plus
  `CacheService`, a small JSON get/set/del/getOrSet/delByPrefix wrapper.
- **Fails open by design**: every method catches its own errors and
  degrades to a cache miss rather than a 500, since Redis here is a
  performance optimization, never a source of truth.
- Wired into the three hottest read paths: `SongsService.findAll` (60s
  TTL, invalidated on song create/update/delete), `DiscoverService.getHome`
  trending (120s TTL), and `SearchService.quickSearch` (30s TTL).
- `GET /api/health` now reports Redis status (non-blocking — a down Redis
  never flips the overall health check to unhealthy).
- Test env (`NODE_ENV=test`) tunes the client to fail fast (no retries,
  1s connect timeout) instead of queuing/retrying, so e2e suites never
  hang waiting on a Redis container that may not exist in CI.

## Real file storage (S3-compatible)
- `src/storage/` — `StorageService` (AWS SDK v3) generates short-lived
  presigned `PUT` URLs against any S3-compatible bucket (AWS S3, MinIO,
  Cloudflare R2, ...). The API never proxies file bytes.
- `POST /api/uploads/presign` — body `{ kind, filename, contentType,
  sizeBytes }`. `kind` is `audio` | `cover` | `avatar`; `audio`/`cover`
  are restricted to ARTIST/ADMIN accounts. Validates content type and a
  per-kind size ceiling (audio 100MB, cover 10MB, avatar 5MB) before
  signing.
- Client flow: presign → `PUT` the file straight to the returned
  `uploadUrl` → send the returned `publicUrl` as `audioUrl` / `coverUrl`
  / `avatarUrl` to the existing songs/albums/users endpoints, which
  already only require a URL — no DTO or schema changes needed.
- `SongsService.update` deletes the previously-referenced bucket object
  when `audioUrl`/`coverUrl` is replaced with a new value.
- `docker-compose.yml` gained a `minio` + `minio-init` service so local
  dev has a real, working bucket out of the box instead of empty env vars.

## In-app notifications
- New `Notification` Prisma model (`type`, `title`, `body`, `data` JSON,
  `readAt`), `type` kept a free-form string so new notification types
  never need a migration.
- `src/notifications/` — `NotificationsService`/`Controller`:
  `GET /me/notifications`, `GET /me/notifications/unread-count`,
  `PATCH /me/notifications/:id/read`, `POST /me/notifications/read-all`.
- Actually wired to real events, not just CRUD scaffolding:
  - Welcome notification on registration (`AuthService.register`).
  - "New release from {artist}" fanned out to every user who has that
    artist saved in their library, when the artist publishes a new song
    (`SongsService.createForUser`).
- Polling-based (no WebSocket/push transport exists yet) — noted as a
  natural next step in `docs/`.

## e2e test coverage: library, discover, search, users
- `test/library.e2e-spec.ts` — likes (like/unlike idempotency, listing),
  playlists (create, add/remove song, duplicate rejection, reorder,
  private-playlist visibility, ownership enforcement, delete), saved
  items (save/unsave album, 404 on non-existent target), listening
  history (record play, playCount increments, history listing).
- `test/discover.e2e-spec.ts` — anonymous vs. signed-in home feed,
  recently-played population, madeForYou genre-affinity mix.
- `test/search.e2e-spec.ts` — quick search, typed+paginated search,
  trigram typo tolerance, validation, and search-history CRUD
  (auth-gated).
- `test/users.e2e-spec.ts` — profile read/update, whitelist stripping of
  unknown fields, public profile lookup, 404 handling, plus notification
  read-state coverage (dogfoods the new notifications endpoints).

## Not included in this phase (explicitly deferred)
- AI/Recommendation engine (`docs/ai.md` still describes the real gap).
- Admin frontend panel — the backend CRUD + RBAC already exists; only a
  UI is missing.
