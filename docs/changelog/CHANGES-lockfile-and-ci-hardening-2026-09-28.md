# Lockfile fix + CI/build hardening (2026-09-28)

## The problem
No `package-lock.json`, yet every CI job ran `npm ci` (which refuses to run
without one) → the pipeline failed on every push. The Docker images also
installed without a lockfile.

## Honest status
This environment has **no npm registry access** (`npm view next` → `403`), so a
real lockfile **cannot be generated here**, and a hand-written one would be
invalid (integrity hashes). What was done instead: CI no longer breaks, the
lockfile can be produced with one click/command in a networked environment, and
drift is detected automatically. **Nothing below was run against npm/CI**;
only the offline pieces (YAML/JSON parsing, `bash -n`, the lockfile checker
against synthetic valid/drifted/bad-host lockfiles) were executed.

## Changes
- `.github/actions/install` — composite action: `npm ci` + npm cache when a
  lockfile exists; otherwise `npm install` with a warning (setup-node's
  `cache: npm` would itself hard-fail without a lockfile). All 4 jobs use it.
- `ci.yml` — new `Lockfile check` job (fails on drift, uploads a generated
  lockfile artifact when missing); `permissions: contents: read`; API lint no
  longer `--max-warnings=0` (ESLint had never run — see below).
- `.github/workflows/lockfile.yml` — “Generate lockfile” (manual): generates,
  verifies, uploads artifact, opens a PR.
- `scripts/check-lockfile.mjs` (+ `npm run lockfile:check`) and
  `scripts/bootstrap-lockfile.sh` (+ `npm run lockfile:generate`).
- `docs/lockfile.md`, README note, audit note cross-reference.

## Related defects found and fixed
1. **No `.gitignore`** — `node_modules`, `.env`, `.next`, `dist` were committable. Added (lockfile deliberately not ignored). Also `.dockerignore`, `.nvmrc` (20), `.npmrc`.
2. **ESLint never worked**: `apps/web` had no `.eslintrc` (`next lint` prompts/fails in CI) and `apps/api` had no ESLint config *or* eslint/@typescript-eslint/prettier dev-dependencies although `lint` calls `eslint`. Added `apps/web/.eslintrc.json`, `apps/api/.eslintrc.js` (extends `packages/config/eslint-base.js`) and the missing devDependencies. **Adding devDependencies changes the lockfile requirement — generate the lockfile after this change.**
3. **Docker images were broken under npm workspaces**: web image never copied `packages/*` (would try to download `@codex-music/types` from the registry); runtime stages copied only `apps/*/node_modules` although workspaces hoist to `/repo/node_modules`; no lockfile use. Rewrote api/web/worker Dockerfiles (`npm ci`, all manifests copied, hoisted `node_modules` shipped). Not built here (no Docker).
4. **`next build` and workspace TS packages**: `@codex-music/*` export raw `src/index.ts`; added `transpilePackages` to `next.config.js`.
5. Dependabot config (npm groups, actions, docker).

## Still to do by you (once)
Run **Actions → Generate lockfile** (or `npm run lockfile:generate`), merge, then
watch the first real CI run: ESLint (new), `tsc`, tests, Docker builds and
`transpilePackages` have not been executed anywhere yet.
