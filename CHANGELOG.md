# Changelog

All notable changes to MELUNE are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/) and the project uses
[Semantic Versioning](https://semver.org/).

The repository is pre-1.0, so minor releases may introduce breaking changes; each
phase note below lists them explicitly. Detailed engineering notes for each phase
live in the `CHANGES-*.md` files at the repository root — this file summarises
them so you can read the history without opening twenty documents.

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

Full detail: `CHANGES-phase6_7.md`, `CHANGES-phase8.md`, `CHANGES-phase8_1.md`,
`CHANGES-phase8_2-ui-review.md`, `CHANGES-phase9-hybrid-recommendations.md`,
`CHANGES-phase10-sonic-canvas.md`, `CHANGES-phase10_1-design-system-ambient-theme.md`,
`CHANGES-phase10_2-player-polish.md`, `CHANGES-phase10_3-home-redesign.md`,
`CHANGES-hls-streaming.md`, `CHANGES-queue-strip-focus-mode.md`,
`CHANGES-sonic-canvas-clip-export.md`, `CHANGES-tempo-amoled-onboarding.md`,
`CHANGES-security-hardening.md`, `CHANGES-test-coverage.md`,
`CHANGES-lockfile-and-ci-hardening-2026-09-28.md`,
`CHANGES-ci-and-verification-2026-09-27.md`, `CHANGES-ci-audit-2026-09-27.md`,
`CHANGES-critical-hardening-2026-09-28.md`, `CHANGES-frontend-polish-2026-09-27.md`.

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
documented in `CHANGES-security-hardening.md` and
`CHANGES-critical-hardening-2026-09-28.md`.
