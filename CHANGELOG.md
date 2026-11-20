# Changelog

All notable changes to MELUNE are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/) and the project uses
[Semantic Versioning](https://semver.org/). Detailed engineering notes for each
phase live in [`docs/changelog/`](docs/changelog/README.md) — this file summarises
them so you can read the history without opening twenty documents.

---

## [1.0.0] — 2026-11-20

First public release of MELUNE as an open-source repository.

### Added
- Public GitHub repository with a complete, self-contained monorepo: web, API,
  mobile, shared packages, AI service, infrastructure and documentation.
- Root README in English and Persian, plus a README for every workspace.
- MIT license, contributing guide, security policy, changelog, issue templates
  and a pull-request template.
- Social preview artwork (`docs/assets/melune-preview.png`) generated from the
  real hero covers.
- Twelve cover concepts in [`docs/assets/`](docs/assets) — including **Persian
  Miniature** (girih geometry), **Analog Cassette**, **Spectrum Glass** and
  **Brutalist Grid** — plus a 1280×320 feature strip and a 1080×1920 story card.
  Every cover ships as font-embedded SVG (editable, renders identically
  anywhere) and a PNG render.
- Media Session integration (`apps/web/src/hooks/use-media-session.ts`): the
  current track's artwork, title and artist appear on the OS lock screen and
  the hardware media keys drive the in-app player.
- Real waveform seek bar (`components/player/waveform-seek-bar.tsx` +
  `hooks/use-track-peaks.ts`): peaks are decoded once per track, cached for the
  tab, and fall back to the plain seek bar when Web Audio or CORS isn't
  available.
- [`docs/roadmap-visuals-fa.md`](docs/roadmap-visuals-fa.md) — the visual and
  product roadmap (covers, in-app visuals, feature packages).
- `scripts/generate-theme-covers.mjs` (`npm run covers:themes`) — generates one
  editable 1280×640 cover per theme straight from `globals.css` tokens plus an
  HTML gallery in `docs/assets/themes/`.
- Dynamic OpenGraph images for track, album, playlist and artist pages
  (`opengraph-image.tsx` per route, shared `lib/og-card.tsx`), with a
  graceful generic card when the API is unreachable.
- Real synced lyrics: a `lyrics` table + forward-only migration, an LRC parser
  and public `GET /lyrics/:songId` plus role-restricted `PUT`/`DELETE`, an
  admin `.lrc` upload page at `/admin/lyrics`, and the player reading real
  lines instead of the old placeholder provider.
- Theme Studio (`/theme-studio`): author a five-color palette with live
  preview, export/import JSON, share it with a `?p=` link, and apply it
  without a flash on reload (inline CSS variables + no-flash script).
- "Listen together" rooms: an authenticated Socket.io namespace with
  in-memory rooms, host-only transport control, presence, and a player panel
  that follows the host's play/pause/seek/track.
- Compact 1280×660 theme grid and a real album-art Cover Flow hero, with
  roomier, aligned spacing in both READMEs.
- Self-hosted the four brand fonts (Sora, Inter, Vazirmatn, Cormorant
  Garamond) as variable woff2 in `apps/web/src/fonts/` instead of
  `next/font/google`. CI's `next build` failed intermittently while parsing
  Google Fonts' CSS (`Cannot read properties of null (reading '1')` in the
  font loader); local builds are now byte-identical and need no network.
- Repository access guide and a helper script for read-only collaborators.

### Changed
- Documentation reorganised: phase notes moved to `docs/changelog/`, README
  encoding normalised to UTF-8, stale links and duplicate `.gitignore` rules
  cleaned up.
- `package.json` now carries repository, homepage, bugs, license and keyword
  metadata, and the version is `1.0.0`.
- Added the full Persian deployment guide (`docs/deploy-oracle-cloudflare-fa.md`),
  the technical analysis (`docs/project-analysis-fa.md`) and a central
  [documentation index](docs/README.md); both root READMEs link to them.

### Fixed
- Web unit tests: Vitest now uses the automatic JSX runtime (matching Next.js),
  `isEditableTarget()` always returns a boolean, and the clip-button test seeds
  its mocked stream and flushes React state updates. All 184 tests pass.
- API lint: waived the framework-mandated `Record<string, any>` override
  signature in `ClientIpThrottlerGuard` and removed two unused imports.
- Prisma schema drift: removed the `extensions = [pg_trgm]` datasource entry
  (`pg_trgm` is still created by the initial migration). Prisma cannot derive
  extension declarations from migration history, so CI's fresh shadow database
  reported a false drift; the check now passes with no difference.
- API unit tests: fixed the admin ban mock, made extension fallback in
  `createUploadUrl` use `.bin` for extensionless filenames, excluded thin
  controllers from unit coverage, and removed per-file coverage thresholds
  that Windows resolved against absolute paths. 242/242 tests pass, 76% lines.
- CI: E2E suites now run serially (`--runInBand`) so shared Postgres state
  cannot race between suites; the Web E2E job starts and polls the Next.js
  server in one step (a background process from a previous step is reaped by
  GitHub Actions).
- Added [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) and an issue-template config
  with links to docs and private security reporting; both READMEs link them.
- Root README stated the repository was private although it is public; the
  access section now describes the actual public status.
- Pull-request template link to `CONTRIBUTING.md` is now repo-relative.

---

## [Unreleased]

### Added
- Production deployment stack: `docker-compose.prod.yml`, Caddy edge with two TLS
  modes (Let's Encrypt / Cloudflare Origin Certificate), and `.env.production.example`.
- `scripts/deploy/configure-domain.sh` — generates `.env.production` with random
  secrets, derives the media host and picks the right Caddyfile.
- `scripts/deploy/oracle-bootstrap.sh` — first-boot VM setup (Docker, swap,
  UFW/iptables, fail2ban, Docker log rotation).
- CI/CD: GitHub Actions deploy workflow over SSH with health waits and smoke tests.
- SEO surface: dynamic `sitemap.xml`, `robots.txt`, OpenGraph image and JSON-LD metadata.
- Media host decoupled from the app host (`MEDIA_DOMAIN`) so deployments under an
  existing subdomain stay inside the free Universal SSL certificate.

### Changed
- Same-origin production topology: `/api/*` and `/socket.io/*` proxied by Caddy,
  removing CORS, cross-site cookie and WebSocket configuration from the client.
- Server-side `trust proxy = 1` plus `ClientIpThrottlerGuard`.

---

## [0.1.0] — Feature-complete demo

Phases 1–10 of the build, condensed:

- **Phase 6/7 — Foundation.** Monorepo scaffold (npm workspaces), shared types and
  typed API client, NestJS + Prisma data layer, Next.js shell, design tokens.
- **Phase 8 — Product UI.** Theme system with 21 themes (six signature themes),
  navigation, library pages, auth screens and the onboarding flow.
- **Phase 8.1/8.2 — UI review pass.** Spacing, contrast, focus states and
  responsive behaviour tightened across breakpoints.
- **Phase 9 — Recommendations.** Hybrid content + collaborative scoring with
  explainable ranking.
- **Phase 10 — Sonic Canvas.** Clip export, ambient visuals and theme-driven
  generative artwork.
- **Phase 10.1–10.3 — Design system, player polish, home redesign.** Shared token
  layer, full-screen queue-based player, and the five-cover cover-flow hero.
- **Security hardening.** DTO validation, throttling, JWT refresh cookies, upload
  rules, non-root containers, security headers.
- **Test coverage.** Unit tests for the API, component tests where valuable, and a
  lockfile guard so the Docker builds cannot drift from the manifest.
- **HLS streaming & queue/strip focus mode.** ffmpeg transcode worker producing
  adaptive renditions; focus mode removes decorative UI while playing.

Full detail: [`docs/changelog/`](docs/changelog/README.md) — the phase notes for
foundation, product UI, UI review, recommendations, Sonic Canvas, design system,
player polish, home redesign, HLS streaming, queue/focus mode, clip export,
tempo/AMOLED/onboarding, security hardening, test coverage, lockfile/CI and
pre-release hardening.

---

## Compatibility notes

| Dependency | Range |
| --- | --- |
| Node.js | `>= 20` |
| PostgreSQL | 16 (15+ should work; search helpers assume modern Postgres) |
| Redis | 7 (6.2+ acceptable) |
| Docker | Engine 24+ with Compose v2 |

## Deprecations

None yet.

## Security fixes

See [SECURITY.md](SECURITY.md) for the reporting process. Historical hardening is
documented in [`docs/changelog/`](docs/changelog/README.md).
