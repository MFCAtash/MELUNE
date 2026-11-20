# @melune/api

The MELUNE backend: NestJS 10 + Prisma + PostgreSQL, JWT authentication, Socket.IO
for realtime presence, BullMQ for transcoding work, S3-compatible storage for media
and a typed REST surface shared with web and mobile through `@melune/types`.

## Modules

```
auth/            Email/password registration & login, JWT access + refresh cookie
catalog/         songs, albums, artists, genres (paginated, filterable)
search/          Postgres full-text search with a Redis read-through cache
library/         likes, history, playlists, saved items
recommendations/ Hybrid content + collaborative scoring
discover/        Editorial feeds and collections
notifications/   In-app notifications + Web Push (VAPID)
push/            Push subscription management
storage/         Presigned S3 uploads (audio / cover / avatar)
queue/           BullMQ queues + workers/audio-transcode.worker.ts (ffmpeg -> HLS)
mail/            Transactional mail (stub today; plug in Resend/Postmark/SES)
analytics/       Event ingestion for listening metrics
admin/           Catalog editing, user management, platform stats
users/           Profiles and account settings
config/          env.validation.ts — fail-fast startup validation
prisma/          PrismaService and schema access
redis/           Redis provider
common/          DTOs (pagination), guards, throttlers
health/          GET /api/health
```

## Running

```bash
npm ci
cp ../../.env.example ../../.env     # or set env vars directly
npm run prisma:generate --workspace=apps/api
npm run prisma:migrate   --workspace=apps/api
npm run dev:api
```

The API listens on `:4000` and mounts everything under the global **`/api`** prefix.
Health check: `GET http://localhost:4000/api/health`.

Compose equivalents: `npm run docker:up` (development) or
`docker-compose.prod.yml` (production).

## Configuration rules

- Everything goes through `ConfigService`; never read `process.env` ad hoc in a
  service body.
- `config/env.validation.ts` rejects missing secrets, malformed TTLs, bad URLs and
  half-set credential pairs at boot. Add new required variables there.
- `DATABASE_URL` host must be `postgres` inside Compose (not `localhost`).
- `CORS_ORIGIN` accepts a comma-separated list of absolute URLs; a stray entry is
  a startup error, not silent rejection.
- Public catalog browse/read routes are throttle-exempt (`@SkipThrottle()`);
  write and admin routes keep the default limit.
- Upload rules live in `config/upload-rules` and cap file size/type — change both
  there and in Cloudflare if you raise the limit.

## Realtime

Socket.IO shares the HTTP server with `/socket.io/*`. In production Caddy proxies
it transparently with `flush_interval -1` so events are not buffered.

## Workers

`audio-transcode.worker.ts` consumes the transcode queue and writes HLS renditions
(128k/192k/320k) into object storage. It runs as its own container in Compose
(`transcode-worker`, the only one with ffmpeg installed).

## Testing

```bash
npm run test            # Jest unit tests
npm run test:cov        # coverage
npm run test:e2e        # e2e (where configured)
```

See [docs/api.md](../../docs/api.md) for the endpoint reference and
[docs/database.md](../../docs/database.md) for the schema.
