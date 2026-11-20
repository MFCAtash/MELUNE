# Lockfile (`package-lock.json`)

CI (`.github/workflows/ci.yml`) and the Docker builds (`infra/docker/*.Dockerfile`)
use `npm ci`, which **requires a committed `package-lock.json`** and fails if it is
missing or out of sync with any `package.json`.

The repository was authored in an offline sandbox, so the lockfile could not be
generated there. Pick **one** of the options below — all produce the same result.

## Option A — GitHub (no local setup)

1. Actions → **Generate lockfile** → *Run workflow*.
2. Merge the PR it opens (if PRs are blocked, download the `package-lock`
   artifact and commit it yourself).
3. PRs created by `GITHUB_TOKEN` don't trigger CI: close/reopen the PR once.

Alternatively, any run of the **CI** workflow uploads a `package-lock-generated`
artifact while the lockfile is missing.

## Option B — locally

```bash
nvm use            # Node 20 (.nvmrc)
npm run lockfile:generate
git add package-lock.json && git commit -m "chore: add package-lock.json"
```

`lockfile:generate` resolves the whole workspace, validates it and runs
`npm ci --dry-run` as final proof.

## What CI does meanwhile

| State | Behaviour |
|-------|-----------|
| No lockfile | Jobs use `npm install` with a warning annotation; the `Lockfile check` job uploads a generated lockfile. Nothing breaks, but builds aren't reproducible. |
| Lockfile in sync | Jobs use `npm ci` with the npm cache. |
| Lockfile out of sync | `scripts/check-lockfile.mjs` fails fast and lists exactly which dependency drifted. |

## Rules going forward

- Change a dependency → run `npm install` and commit the updated lockfile in the same PR.
- Never hand-edit the lockfile; never add it to `.gitignore`.
- `scripts/check-lockfile.mjs` also rejects packages resolved from a non-npmjs host or without an `integrity` hash.
- Once committed, consider deleting the fallback branch in `.github/actions/install/action.yml` to make a missing lockfile a hard failure.
