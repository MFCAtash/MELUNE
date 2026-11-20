# CI workflow, migration-drift guard, and verification of the frontend-polish pass (2026-09-27)

Follow-up to a code review that flagged three issues. Each is addressed
below, including where the review's original framing turned out to be
only partly right once checked against `docs/database.md`.

## 1. `.github/workflows/ci.yml` — actually added

`CHANGES-security-hardening.md` documented this file as added, and
`docs/database.md` already referenced it by path
("`prisma migrate deploy` ... is the only command CI
(`.github/workflows/ci.yml`) and production ever run against a
database"), but the file itself was never committed — a real
documentation/code mismatch, exactly as flagged.

Added now, with more scope than the original changelog described:

- **`schema-drift`** — `prisma migrate diff --exit-code` against a
  throwaway shadow database, runs first, fails fast. See item 2.
- **`api`** — lint, typecheck, Jest unit tests (`test:cov`), Jest e2e
  tests, build. Real `postgres:16-alpine` + `redis:7-alpine` service
  containers, migrated with `prisma migrate deploy` (never `db push`,
  never `migrate dev`, matching `docs/database.md`'s own rule for
  CI/production). Coverage uploaded as a build artifact.
- **`web`** — lint, typecheck, Vitest unit tests, build.
- **`web-e2e`** — a separate job (needs the full stack, not just a
  static build): builds and boots both the API and the web app against
  a migrated database, waits on both `/api/health` and the web root,
  then runs the existing `apps/web/e2e/*.spec.ts` Playwright specs.
  This is new relative to what the original changelog described — that
  pass only covered the API side. `apps/web/e2e/` and the
  `@playwright/test` devDependency already existed in the repo with
  nothing running them; `README.md`'s tech-stack table has been
  corrected to stop saying Playwright "is not set up yet."
- `apps/mobile` and `services/ai` are deliberately excluded — both are
  documented as initial skeletons with "no tests, no CI job" (see
  `apps/mobile/README.md`), and this workflow doesn't change that.

`README.md` gained a short "## CI" section describing this pipeline,
and the testing commands section now lists the web-side test commands
alongside the existing API ones.

## 2. Migration history — reviewed, not rewritten

The review's concern (2 migrations across 12+ phases implies the
schema was squashed rather than built incrementally) is factually
correct, but `docs/database.md`'s existing "Baseline migration"
section already documents this as a deliberate choice, not an
oversight: `20260926000000_init` is checked in *as* a baseline
(Phases 1–8.2's entire schema, generated once with
`prisma migrate dev --name init` against a clean database), with an
explicit rule that migrations already applied anywhere are immutable
and further changes get new migrations from that point on — which is
exactly what the second migration
(`20260926010000_add_song_hls_playlist_url`) does correctly.

Splitting the baseline into fabricated per-phase migrations after the
fact would recreate history that never actually ran anywhere, which is
worse than the current state, not better — and `docs/database.md`
explicitly warns against hand-editing an applied migration for this
reason. So this changelog corrects course from the previous review's
framing: **no history rewrite.**

What actually reduces the risk a squashed baseline carries — an
undetected drift between it and `schema.prisma` — is guarding it going
forward, which item 1's `schema-drift` CI job now does on every push.
`docs/database.md` gained a short section explaining that guard next
to the section it protects.

## 3. Verification of `CHANGES-frontend-polish-2026-09-27.md`

That pass's own verification note said `lint`/`tsc`/`vitest` were
never run (no network access in that environment) and asked reviewers
to run them before merging. **This environment has the same
constraint** — no network access, so `npm install` cannot fetch
`node_modules` and a real `next lint` / `tsc --noEmit` / `vitest run`
cannot be executed here either. Rather than skip verification or
silently claim tools were run when they weren't, every cross-file
contract that pass introduced was checked by hand against the actual
current source (not from memory):

| Claim in the frontend-polish changelog | Checked against | Result |
|---|---|---|
| `SonicCanvas` accepts `mode="bars"`, `variant="compact"`, `color` | `components/player/sonic-canvas.tsx`'s `SonicCanvasProps` | Matches exactly |
| `useAmbientTheme(coverUrl, seed)` signature reused in the mini-player | `hooks/use-ambient-theme.ts` | Matches; same two positional args as the existing `app-shell.tsx`/`full-screen-player.tsx` call sites |
| `PlasmaBackground` has a new `intensity="page"` | `components/player/plasma-background.tsx` | `intensity?: "ambient" \| "full" \| "page"` present, `isPage` branch implemented |
| New `AmbientPageBackdrop` wired into both `artist/[id]/page.tsx` and `album/[id]/page.tsx` | Both page files | Both import and render it with the documented `relative isolate overflow-hidden` wrapper |
| `EmptyState` gained an optional `illustration` prop, existing callers unaffected | `components/ui/empty-state.tsx` | Prop is optional, rendered above the heading, no required-prop change |

No mismatches found. This is real signal (these are exactly the kind
of prop-name/signature drift a `tsc --noEmit` run would catch) but it
is **not a substitute** for actually running the full toolchain — it
doesn't catch type errors inside a function body, unused-variable
lint rules, or the Vitest/Playwright suites actually passing. That
still needs to happen in an environment with registry access, per the
original changelog's own request, which stands. The new `ci` workflow
in item 1 is what makes that happen automatically on the next push
instead of depending on a manual run.
