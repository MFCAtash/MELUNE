# Deployment

Reserved for Phase 12. Phase 1 deployment surface is local-only via
`docker-compose.yml` (see development.md). Production concerns —
reverse proxy, HTTPS, managed Postgres/Redis, CI/CD deploy step,
observability — are addressed together in Phase 12 so they're designed
against a feature-complete app rather than guessed early.

## Database migrations

The one piece of the deploy story that already exists, because it has
to exist before any environment beyond a laptop is safe to run against:
schema changes ship as committed Prisma migrations
(`apps/api/prisma/migrations/`, see `docs/database.md#migrations`),
never as `prisma db push`.

Whatever process eventually deploys the API (container orchestrator
release hook, a one-off job, a CI/CD step — to be decided in Phase 12)
must run this once per deploy, against the target database, **before**
the new API process starts serving traffic:

```bash
npm run prisma:migrate:deploy --workspace=apps/api
```

`infra/docker/api.Dockerfile` already copies `apps/api/prisma`
(migrations included) into the runtime image, so this can run as a
pre-start step in that same container — `prisma migrate deploy` is
idempotent (it only applies migrations not yet recorded as applied) and
safe to run on every deploy, including ones with no new migration.
`.github/workflows/ci.yml` runs the identical command against the
ephemeral CI Postgres service before tests, so the exact migration path
that will run in production is also what CI verifies on every PR.
