# Test coverage hardening (catalog / library / storage / admin) + CI

Addresses the four test-coverage gaps flagged by risk, highest first, plus
the coverage-enforcement and CI infrastructure needed to keep them from
regressing.

## 1. Catalog — highest attack surface (CRUD + ownership)

New specs, each using the same lightweight manual-mock pattern already
established in `admin.service.spec.ts` (plain `jest.fn()` stand-ins for
`PrismaService` and its collaborators, no `TestingModule` boilerplate):

- `apps/api/src/catalog/songs/songs.service.spec.ts` — `findAll`
  read-through caching and filter scoping, `findOne` 404, `createForUser`
  vs `createByAdmin` (missing artist profile, invalid `artistId`, cross-
  artist `albumId`, non-existent `genreId`), `update` (ownership via
  `ArtistsService.assertOwnership`, `artistId` stripped from the payload,
  old-file cleanup on URL replacement, admin bypass), `remove` (soft
  delete + cache invalidation, blocked for non-owners).
- `apps/api/src/catalog/albums/albums.service.spec.ts` — the same
  create/update/remove ownership matrix, plus `releaseDate` string→Date
  parsing.
- `apps/api/src/catalog/artists/artists.service.spec.ts` — duplicate
  profile rejection (`ConflictException`), admin-created profiles left
  with no linked user, and every branch of `assertOwnership` (admin
  bypass, owner match, non-owner block, catalog-only `userId: null`
  profile).
- `apps/api/src/catalog/genres/genres.service.spec.ts` — duplicate-name
  conflict, 404-before-mutate on update/remove, slug re-derivation.

## 2. Library — aggregation logic

- `apps/api/src/library/likes/likes.service.spec.ts` — `like` is
  idempotent (upsert, not insert-or-fail) and rejects a missing/soft-
  deleted song; `findMine` maps rows down to their `song`.
- `apps/api/src/library/saved-items/saved-items.service.spec.ts` — all
  three type-specific branches (`album` / `artist` / `playlist`) for
  `save`, `unsave`, and `findMine`'s optional type filter, plus the
  existence check per type.
- `apps/api/src/library/history/history.service.spec.ts` — `recordPlay`
  writes history + increments `playCount` in one `$transaction`;
  `recentSongIds` dedupes by song keeping the latest play and respects
  `limit`; `topGenres` counts, ignores songs with no genre, sorts
  descending, and truncates to `limit`.
- `apps/api/src/library/playlists/playlists.service.spec.ts` — private-
  playlist visibility (404, not 403, for a non-owner), `create`'s
  `isPublic` default, ownership enforcement across
  update/remove/addSong, position math in `addSong` (empty playlist vs.
  appending), the unique-constraint→`BadRequestException` translation,
  and `reorder`'s validation (accepts a true permutation; rejects a
  dropped song, an added song, and — the easy-to-miss case — a
  duplicated id that only collapses the *size* mismatch check when
  compared via `Set`).

## 3. Storage — presigned uploads

`apps/api/src/storage/storage.service.spec.ts`, with `@aws-sdk/client-s3`,
`@aws-sdk/s3-request-presigner`, and `uuid` mocked at the module level so
no real AWS/S3 calls happen:

- `configured` flips correctly based on access/secret key presence.
- `canUploadKind` — `AUDIO`/`COVER` restricted to `ARTIST`/`ADMIN`,
  `AVATAR` open to any role.
- `createUploadUrl` **actually rejects**, not just "doesn't crash on":
  - storage not configured (before any other validation runs),
  - a `contentType` outside the kind's allow-list (explicit assertion on
    the rejection message, not just the exception type),
  - `sizeBytes` over the kind's `maxSizeBytes` (with a boundary case at
    exactly the max, confirming the `>` comparison is inclusive of the
    limit),
  - and, on the success path, that the object key is built from the
    kind's prefix + owner id + a fresh uuid, with a `.bin` fallback for
    an extension-less filename.
- `deleteObject` no-ops when unconfigured, sends a real
  `DeleteObjectCommand` when configured, and swallows delete errors
  (best-effort cleanup, never surfaces to the caller).
- `keyFromPublicUrl` round-trips a key it generated and returns
  `undefined` for a foreign URL.

## 4. `admin.e2e-spec.ts` — real HTTP, not just the service

`admin.service.spec.ts` already covered the guardrail logic in isolation;
this adds `apps/api/test/admin.e2e-spec.ts`, boots the real `AppModule`
(actual Postgres via `PrismaService`, actual `RolesGuard`) and drives it
with `supertest`, matching the existing `catalog.e2e-spec.ts` /
`library.e2e-spec.ts` pattern:

- Every `/api/admin/*` route: 401 with no token, 403 for an authenticated
  non-admin (stats, users, role, ban, unban — all five).
- `GET /api/admin/stats` and `GET /api/admin/users?q=...` return real
  data to an admin.
- Self-demote and self-ban are blocked **through the HTTP route**, with
  the response body's message asserted and the DB state confirmed
  unchanged — this is the scenario risk review called out specifically,
  since a guard bypass or wrong `@CurrentUser()` wiring only shows up at
  the controller/HTTP layer, not in a direct service-level unit test.
  A second admin account confirms the same route *does* work against
  someone else's account, so the block is ownership-based, not routing
  being broken.
- Ban → login fails immediately; unban → login succeeds again.
- Banning a non-existent user id returns 404.

## 5. Coverage enforcement

`apps/api/jest.config.js`:

- `coverageThreshold: { global: { lines: 70 } }` — `jest --coverage`
  (and therefore CI) now fails the build if line coverage across
  `apps/api/src` drops below 70%, instead of coverage being purely
  informational.
- `collectCoverageFrom` excludes `*.module.ts` and `*.dto.ts` (wiring and
  data shape, not logic) and `main.ts` (bootstrap) from the denominator,
  so the threshold measures actual business logic rather than being
  diluted by files that have nothing to unit-test.
- Added `coverageReporters: ["text", "text-summary", "lcov"]` so CI logs
  show an inline summary and `lcov.info` is available for the uploaded
  artifact / any future coverage-badge tooling.

`apps/api/package.json` / root `package.json`: new `test:cov` script
(`jest --coverage`), plus a root passthrough so `npm run test:cov` /
`npm run test:e2e` work from the repo root the same way `npm run test`
already did.

## 6. CI

**Note:** `CHANGES-security-hardening.md` states a `.github/workflows/ci.yml`
was already added in an earlier phase, but this archive's export doesn't
contain a `.github/` directory at all (likely stripped during export) —
so this is a from-scratch recreation, not an edit of an existing file.

Added `.github/workflows/ci.yml`:

- Triggers on push/PR to `main`.
- Spins up real `postgres:16` and `redis:7` service containers
  (health-checked) rather than mocking the DB/cache at the CI level —
  the e2e suite needs a real Postgres, and using the same real Postgres
  for the coverage run keeps one code path instead of two.
- Steps: `npm ci` → `prisma generate` → `prisma db push` (schema sync;
  `db push` rather than `migrate deploy` because no `prisma/migrations/`
  directory ships in this tree — swap to `migrate deploy` once real
  migrations exist) → `lint` → `typecheck` → `test:cov` (**this is the
  gate**: fails the job the moment the 70%-line threshold in
  `jest.config.js` is breached) → uploads the coverage report as a build
  artifact → `test:e2e` → `build`.
- All secrets are inline CI-only dummy values (`ci_test_secret_do_not_use_in_prod`,
  a throwaway DB password) — nothing here is a real credential.

## Tests touched vs. added

Everything under "Tests touched vs. added" is **added**, not modified —
no existing spec's assertions changed. Existing specs untouched:
`admin.service.spec.ts`, `auth.service.spec.ts`,
`recommendations.service.spec.ts`, and all pre-existing
`test/*.e2e-spec.ts` files.

## Verification

Not run in this environment (no network access → no `npm install`
possible here). Before merging:

```bash
npm install
npm run test:cov --workspace=apps/api   # unit tests + 70% line-coverage gate
npm run test:e2e --workspace=apps/api   # needs local Postgres + Redis (see .env.example)
```
