# Database — Phase 1

## Stack

- PostgreSQL 16 (via `postgres:16-alpine` in Docker Compose)
- Prisma ORM (`apps/api/prisma/schema.prisma`)

## Current schema

### `User`

| Field         | Type      | Notes                            |
|---------------|-----------|-----------------------------------|
| id            | uuid      | primary key                      |
| email         | string    | unique                            |
| username      | string    | unique                            |
| password      | string    | bcrypt hash, cost factor 12       |
| role          | enum      | USER \| ARTIST \| ADMIN           |
| avatarUrl     | string?   | nullable                          |
| bio           | string?   | nullable                          |
| emailVerified | boolean   | default false (Phase 2)           |
| createdAt     | datetime  | default now()                     |
| updatedAt     | datetime  | auto-updated                      |
| deletedAt     | datetime? | soft delete                       |

### `RefreshToken` (Phase 2)

One row per issued refresh token (per device/session). Only the SHA-256
hash of the opaque token is stored — never the raw value — so a DB leak
doesn't hand out usable sessions. `revokedAt` supports logout and
rotation-on-refresh; a stolen-but-already-rotated token is rejected.

| Field     | Type      | Notes                     |
|-----------|-----------|----------------------------|
| id        | uuid      | primary key                |
| userId    | uuid      | FK → users, cascade delete |
| tokenHash | string    | unique, sha256              |
| expiresAt | datetime  |                             |
| revokedAt | datetime? | set on logout/rotation      |
| createdAt | datetime  |                             |

### `PasswordResetToken` / `EmailVerificationToken` (Phase 2)

Same hashed-opaque-token pattern as `RefreshToken`, with a `usedAt`
field instead of `revokedAt` (single-use). 1-hour TTL for password
reset, 24-hour TTL for email verification.

### `Genre` (Phase 3)

| Field | Type   | Notes  |
|-------|--------|--------|
| id    | uuid   |        |
| name  | string | unique |
| slug  | string | unique |

### `Artist` (Phase 3)

One-to-one with `User` (nullable — an artist profile can outlive the
user account being deleted, hence `onDelete: SetNull` rather than
`Cascade`). `slug` is auto-generated from `name` with a numeric suffix
on collision (`ArtistsService.uniqueSlug`).

| Field     | Type      | Notes                          |
|-----------|-----------|----------------------------------|
| id        | uuid      |                                   |
| userId    | uuid?     | unique, FK → users, SetNull       |
| name      | string    |                                   |
| slug      | string    | unique                            |
| bio       | string?   |                                   |
| imageUrl  | string?   |                                   |
| deletedAt | datetime? | soft delete                       |

### `Album` (Phase 3)

| Field       | Type      | Notes                       |
|-------------|-----------|-------------------------------|
| id          | uuid      |                                |
| title       | string    |                                |
| slug        | string    | unique                         |
| artistId    | uuid      | FK → artists, cascade delete   |
| coverUrl    | string?   |                                |
| releaseDate | datetime? |                                |
| deletedAt   | datetime? | soft delete                    |

### `Song` (Phase 3)

| Field     | Type      | Notes                                |
|-----------|-----------|----------------------------------------|
| id        | uuid      |                                         |
| title     | string    |                                         |
| slug      | string    | unique                                  |
| artistId  | uuid      | FK → artists, cascade delete            |
| albumId   | uuid?     | FK → albums, SetNull                    |
| genreId   | uuid?     | FK → genres, SetNull                    |
| duration  | int       | seconds                                 |
| audioUrl  | string    |                                          |
| coverUrl  | string?   | falls back to album cover in the UI     |
| playCount | int       | default 0 — incremented from Phase 5 on |
| bpm       | int?      | Phase 8.2 — recommendation-engine feature |
| mood      | string?   | Phase 8.2 — free-form tag, recommendation-engine feature |
| energy    | float?    | Phase 8.2 — 0..1, recommendation-engine feature |
| deletedAt | datetime? | soft delete                             |

`bpm`/`mood`/`energy` are all optional — most songs are ingested without
audio analysis, and `RecommendationsService` falls back to genre +
artist alone when they're unset. See `docs/ai.md`.

Ownership: a `Song`/`Album` is owned by whoever owns its `Artist`
profile (`Artist.userId`). `ArtistsService.assertOwnership` is the
single place that rule is enforced — every mutating catalog endpoint
calls through it.

## Search (Phase 6)

No separate search engine (Elasticsearch, etc.) — Postgres does both
sides of the ranking at this scale:

- **Trigram matching** (`pg_trgm`) — tolerates typos and partial
  words. Enabled via `extensions = [pg_trgm]` on the `datasource`
  block (`postgresqlExtensions` preview feature), with a GIN index
  per searchable column: `@@index([title(ops: raw("gin_trgm_ops"))],
  type: Gin)` on `Song.title`, `Artist.name`, `Album.title`,
  `Playlist.title`. This is what makes `similarity()`, `%`, and
  `ILIKE '%...%'` fast instead of a sequential scan.
- **Full-text ranking** (`tsvector`/`tsquery`) — scores whole-word
  relevance. Computed at query time as
  `to_tsvector('simple', col) @@ plainto_tsquery('simple', q)` inside
  `SearchService`'s raw SQL, rather than as a stored generated column
  — Prisma's schema DSL has no way to declare a generated/computed
  column, so there's nothing to put in `schema.prisma` for this part.
  `prisma/sql/enable-search.sql` adds matching *expression* GIN
  indexes (also not expressible in the schema DSL) as an optional,
  run-once performance step once a table is large enough that
  `EXPLAIN ANALYZE` shows a sequential scan on that branch — the
  trigram indexes above are what actually make search fast at this
  project's scale.
- **Ranking**: `ORDER BY GREATEST(similarity(...), ts_rank(...)) DESC, "playCount" DESC` — popularity only breaks ties between
  equally-relevant matches; it never lets a popular-but-irrelevant row
  outrank a real match.

```
search_history
---------------------------------------
id         uuid
userId     uuid    FK → users, cascade delete
query      string
createdAt  datetime  default now()
```

One row per *committed* search (Enter, or picking a result) —
deliberately not one row per debounced keystroke. Written by
`SearchController.recordHistory`; the `GET /search` endpoint itself
never writes here. Trimmed to the last 20 rows per user on every
write (`SearchService.recordHistory`), so there's no cleanup job to
run. Guests have no row here at all — the frontend falls back to a
per-browser localStorage list for them.

## Why not the rest of the schema yet

The remaining entities (Notification) are defined incrementally
alongside the phase that introduces them:

- Phase 7 (Analytics) — aggregated views / materialized tables.
- Phase 9 (Recommendations, collaborative/hybrid) — a dedicated
  `Recommendation`/feature-store table if and when a separate service
  needs to persist precomputed results. Phase 8.2's content-based
  engine (see `docs/ai.md`) is stateless and query-time, so it only
  needed three new nullable `Song` columns (`bpm`, `mood`, `energy`),
  not a new table.

## Migrations

Schema history is tracked with real Prisma migrations under
`apps/api/prisma/migrations/`, committed to git — **not** with
`prisma db push`. `db push` is fine for one-off local prototyping
(it force-syncs a database to whatever `schema.prisma` says right
now), but it keeps no history, generates no reviewable SQL, and can
silently drop/recreate columns to make the schema match — none of
which is acceptable for CI or production. Everything from this point
on goes through `prisma migrate`.

### Baseline migration

`apps/api/prisma/migrations/20260926000000_init/migration.sql` is the
baseline: one migration containing the entire schema as it stands
today (Phases 1 through 8.2 — every table in the "Current schema"
section above, `pg_trgm`, and every trigram index). It was generated
with `prisma migrate dev --name init` against a clean database and
checked in as-is, together with the matching
`apps/api/prisma/migrations/migration_lock.toml` (records the
provider — also committed, never edit it by hand). Do **not** hand-edit
`migration.sql` files after they've been applied anywhere; once a
migration has run against a real database (including CI), treat it as
immutable and add a new migration for any further change.

### Local development — creating a new migration

```bash
npm run prisma:migrate --workspace=apps/api -- --name <change_description>
```

This runs `prisma migrate dev`, which:

1. Diffs `schema.prisma` against the migration history.
2. Generates a new `apps/api/prisma/migrations/<timestamp>_<change_description>/migration.sql`.
3. Applies it to your local database (`npm run docker:up` /
   `docker compose up postgres` first) and regenerates the Prisma
   Client.

Commit the new migration folder alongside the `schema.prisma` change
that produced it, in the same PR. Never edit `schema.prisma` without
also generating and committing the migration — CI and production only
ever apply committed migration files; they never read `schema.prisma`
directly to decide what SQL to run.

### CI and production — applying migrations

```bash
npm run prisma:migrate:deploy --workspace=apps/api
# or, from the repo root:
npm run prisma:migrate:deploy
```

This runs `prisma migrate deploy`: a non-interactive command that
applies every committed migration under `apps/api/prisma/migrations/`
that hasn't already been applied, in order, and does nothing else — no
prompting, no drift detection/reset, no schema introspection. It is
the only command CI (`.github/workflows/ci.yml`) and production ever
run against a database. `pg_trgm` (`CREATE EXTENSION IF NOT EXISTS`)
is part of the baseline migration itself, so the target Postgres role
needs `CREATE EXTENSION` privileges the first time this runs — true
for both the CI `postgres:16` service and the default Docker Compose
superuser locally. Once the catalog is large enough to want the extra
full-text indexes described in the Search section above, run `npm run
prisma:search:setup --workspace=apps/api` as a separate, optional
step — it is plain SQL outside the migration history by design (see
that section).

### Guarding the baseline — schema drift check

A squashed baseline is only as trustworthy as the guarantee that it
still matches `schema.prisma` exactly. `.github/workflows/ci.yml`'s
`schema-drift` job enforces this on every push/PR, before any other
job runs: `prisma migrate diff --from-migrations ./prisma/migrations
--to-schema-datamodel ./prisma/schema.prisma --shadow-database-url
<scratch db> --exit-code` replays every committed migration into a
throwaway database and diffs the result against `schema.prisma`;
a non-zero exit (any difference at all) fails the build. In practice
this means: edit `schema.prisma` without generating a matching
migration, and CI fails on the very next push — the drift can't
silently reach `main`, let alone `prisma migrate deploy` in
production.
