# CI/CD audit and fixes (2026-09-27, follow-up)

Follow-up to a request for a full repository audit. This environment has
no network access (confirmed: `npm install` fails with `403 Forbidden`
against `registry.npmjs.org`), so nothing below was verified by actually
running `npm ci` / `lint` / `typecheck` / `test` / `build`. Every finding
was checked by hand against the current source. That constraint is the
same one `CHANGES-ci-and-verification-2026-09-27.md` already documented
for the previous pass.

## Fixed

1. **No lockfile, but CI uses `npm ci`.** *(Superseded — see CHANGES-lockfile-and-ci-hardening-2026-09-28.md: the lockfile itself still has to be generated with network access, but CI no longer breaks without it.)* Originally: still unresolved — `npm ci`
   requires `package-lock.json`, and generating one requires registry
   access this environment doesn't have. Needs `npm install` run once in
   an environment with network access, with the result committed.

2. **Playwright/API origin mismatch in `web-e2e`.** `apps/web/e2e/utils/mock-api.ts`
   and `playwright.config.ts` are both written for a fully mocked
   backend (`API_ORIGIN` defaults to `http://localhost:4310`, a port
   nothing listens on, specifically so no request can escape the mock).
   `.github/workflows/ci.yml`'s `web-e2e` job nonetheless spun up real
   `postgres`/`redis` service containers, ran `prisma migrate deploy`,
   started the real API, and built the web app with
   `NEXT_PUBLIC_API_URL=http://localhost:4000` — the opposite of what
   the test files assume, so requests could bypass the mocks entirely.
   Fixed by rewriting the job: no service containers, no API start, no
   migrations; `NEXT_PUBLIC_API_URL=http://localhost:4310` to match
   `mock-api.ts`'s `API_ORIGIN` default; `needs: [web]` instead of
   `needs: [api, web]`, since this job no longer depends on the API job
   at all.

3. **`npx wait-on` used but not a declared dependency.** Rather than add
   a new pinned devDependency (which would need a lockfile update this
   environment can't produce), replaced it with a `curl --fail --retry`
   style loop waiting on the single web server this job now starts —
   the simpler, dependency-free option the original audit request
   explicitly allowed.

4. **`apps/api`'s `lint` script mutated source (`--fix`).** Split into
   non-mutating `lint` and a new `lint:fix`. CI already called
   `npm run lint`, so this changes CI's actual behavior (no longer
   silently rewrites files during validation) without changing the CI
   config itself.

5. **`README.md` drift.** The Testing and CI sections still described
   the old (incorrect) "Playwright needs the API + a migrated DB"
   design. Updated both to describe the actual, mock-only design now
   that item 2 makes the code match the tests' own documented intent.

## Audited, no changes needed

Checked by hand, not by running tooling:

- `apps/api/src/main.ts` — helmet, cookie parser, scoped CORS, global
  `ValidationPipe` (whitelist + forbidNonWhitelisted + transform) all
  present.
- Rate limiting — global `ThrottlerGuard` (100 req/min) via `APP_GUARD`,
  tightened to 5 req/min on `auth` endpoints, opted out on read-heavy
  public catalog/discover endpoints with `@SkipThrottle()`. Consistent.
- `auth/guards/roles.guard.ts` — rejects when no user or role not in the
  required set; no bypass found.
- `health/health.controller.ts` — `@Public()`, checks Postgres via
  `SELECT 1`, treats Redis as a soft dependency. No unauthenticated data
  exposure.
- No `@ts-ignore` anywhere in `apps/api/src` or `apps/web/src`.
- No `any`-typed declarations (`: any`, `<any>`, `as any`) in either
  app's `src/`.
- No hardcoded real secrets/keys; `.env.example` values are clearly
  placeholder/dev-only (`codex_dev_password`, `change_me_dev_only`, etc.),
  matching `ci.yml`'s own comment that its inline env values are
  CI-only and never real credentials.
- Recommendation/analytics/notification services that looked at first
  grep like candidates for N+1 queries (`admin`, `analytics`,
  `discover`, `notifications`, `push`, `recommendations/collaborative`,
  `recommendations`, `search`) were read in full: every one batches
  with `findMany({ where: { id: { in: [...] } } })` or `Promise.all`
  rather than querying inside a loop.
- Two empty `catch (e) {}` blocks in `apps/web/src/app/layout.tsx` are
  intentional (no-flash locale/theme inline scripts falling back to a
  default on a `localStorage`/`JSON.parse` failure), not swallowed
  errors.
- No `TODO`/`FIXME`/`XXX` markers in `apps/api/src` or `apps/web/src`.
- `docker-compose.yml` ports and `.env.example` values agree with each
  other and with `ci.yml`'s service container config.

## Still not verified

`npm ci`, `npm run lint`, `npm run typecheck`, `npm test`,
`npm run test:e2e`, `npm run build`, and `prisma migrate deploy` were
**not executed** — this environment has no registry access. Nothing in
this changelog should be read as "CI passes"; it should be read as
"the code and config are internally consistent as far as manual
inspection can tell." Before merging, run the full toolchain listed
above in an environment with npm registry access, starting with
`npm install` to produce the missing lockfile.
