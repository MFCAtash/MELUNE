# Contributing to MELUNE

Thanks for taking the time to contribute. This document describes the workflow,
the conventions we hold ourselves to, and the checks that run automatically.

---

## Getting set up

```bash
git clone https://github.com/<you>/melune.git
cd melune
npm ci
cp .env.example .env            # adjust DATABASE_URL if needed
npm run prisma:generate --workspace=apps/api
npm run prisma:migrate --workspace=apps/api
npm run dev:api                 # terminal 1
npm run dev:web                 # terminal 2
```

On Windows you can skip the manual database setup with `start-melune.ps1`, which
boots the bundled Postgres and Redis from `.infra/`.

---

## Branching model

- `main` is always deployable. Deployments run from it.
- Create a topic branch per change: `feat/...`, `fix/...`, `chore/...`, `docs/...`.
- Keep pull requests focused — one concern per PR, with its own tests.

---

## Coding conventions

- **TypeScript everywhere**, strict mode, no `any` unless it is justified in a
  comment and reviewed.
- **Types shared across apps live in `packages/types`.** Web and mobile consume
  the same types through `@codex-music/api-client`; never redeclare API shapes
  locally.
- API controllers are thin; business logic belongs in services. Validation uses
  DTOs with `class-validator` (`ValidationPipe` is global).
- Environment access goes through `ConfigService`. Add new variables to
  `.env.example` *and* `.env.production.example`, and validate them in
  `apps/api/src/config/env.validation.ts` when missing values would cause silent
  breakage rather than a clean crash.
- UI follows the theme tokens in `apps/web/src/app/globals.css`. Do not hardcode
  colours or font sizes; use the existing utility classes.
- Persian copy is first-class. Keep English strings in sync, respect RTL, and
  avoid concatenating translated fragments.
- Database changes require a Prisma migration. Migrations move forward only —
  never edit an applied migration; add a new one instead.

---

## Commit style

```
<type>: <short imperative summary>

<optional body>
```

Types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `perf`, `security`.
Examples:

- `feat(api): paginate genre song listings`
- `fix(web): keep theme menus above hero artwork`
- `docs: document production TLS modes`

Never commit:

- `.env` or any secret (including `.env.production`)
- `.db-backup/`, `*.dump`, `backups/`
- generated media under `apps/web/public/audio-full/*.tmp`
- build output (`dist/`, `.next/`) or dependency trees (`node_modules/`)
- TLS material (`*.pem`, `*.key`, `*.crt`)

---

## Checks before opening a PR

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

CI runs the same suite (plus the lockfile guard) on every push:
[.github/workflows/ci.yml](.github/workflows/ci.yml).

If your change touches the Docker images, also validate the compose files:

```bash
docker compose -f docker-compose.prod.yml config
```

---

## Pull request process

1. Open the PR against `main` using [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md).
2. Fill in the checklist — it exists so reviewers can verify behaviour quickly.
3. Keep the description factual: what changed, why, how it was tested.
4. Request review when checks are green. Respond to comments with a fix or an
   explanation; do not force-push over others' branches.
5. Squash-merge once approved (or merge with a descriptive message).

---

## Reporting bugs

Use the bug report template. Include:

- app/package version and commit SHA
- environment (OS, Node version, browser or mobile target)
- exact steps, expected result, actual result
- logs/screenshots where relevant (never credentials)

---

## Code of conduct

Be direct and kind. Critique code, not people. We follow the spirit of the
[Contributor Covenant](https://www.contributor-covenant.org/) — harassment,
personal attacks and discriminatory language are not acceptable in issues, PRs or
chat.

---

## Questions

Open a discussion or an issue tagged `question` if something here is unclear.
