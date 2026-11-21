# MELUNE documentation index

All documentation lives under `docs/`. Start with the root
[README](../README.md) (English) or [README-FA](../README-FA.md) (Persian) for
installation and a feature tour.

## Guides

| Document | What it covers |
| --- | --- |
| [architecture.md](architecture.md) | Module map, request flows, realtime playback, production topology |
| [api.md](api.md) | REST endpoints, conventions, auth and pagination |
| [database.md](database.md) | Prisma schema, indexes, full-text search, migrations, backups |
| [design-system.md](design-system.md) | Themes, CSS tokens, RTL, shared UI components |
| [development.md](development.md) | Day-to-day workflow, scripts, coding rules |
| [deployment.md](deployment.md) | Docker Compose production stack and operational checklist |
| [deploy-oracle-cloudflare.md](deploy-oracle-cloudflare.md) | Oracle Cloud Always Free + Cloudflare, English step-by-step |
| [deploy-oracle-cloudflare-fa.md](deploy-oracle-cloudflare-fa.md) | همان مسیر استقرار، راهنمای کامل فارسی |
| [ai.md](ai.md) | Optional FastAPI recommendation service |
| [lockfile.md](lockfile.md) | Why `package-lock.json` is committed and how CI guards it |
| [github-access.md](github-access.md) | Repository roles and read-only collaborator script |
| [media.md](media.md) | Demo media storage: direct-in-git trade-offs and moving to R2 |
| [project-analysis-fa.md](project-analysis-fa.md) | تحلیل فنی جامع مونوریپو (سند تاریخی ۲۰۲۶-۱۱-۱۸) |
| [roadmap-visuals-fa.md](roadmap-visuals-fa.md) | نقشهٔ راه جلدها، هویت بصری و قابلیت‌های نمایشی |

## Visual assets

All covers, screenshots and the social preview live in
[`assets/`](assets). Each cover ships as an editable SVG plus a PNG render at
1280×640. The hero cover used in both READMEs is **Emerald Editorial**.

The 1:53 [project demo video](assets/melune-demo.mp4) (4.6 MB, H.264/AAC) is
embedded at the top of both root READMEs through a purpose-built 1280×720
[cover](assets/melune-demo-cover.png) with player chrome and a play button.
Because GitHub blob pages don't play videos, the READMEs link it via GitHub
Pages at [mfcatash.github.io/MELUNE/assets/melune-demo.mp4](https://mfcatash.github.io/MELUNE/assets/melune-demo.mp4)
(verified to play in Chrome/Edge), and the repo file
[`assets/melune-demo-poster.png`](assets/melune-demo-poster.png) and the
[animated GIF teaser](assets/melune-demo-teaser.gif) are kept alongside it.

## Release history

- [CHANGELOG.md](../CHANGELOG.md) — versioned summary, starting with 1.0.0.
- [changelog/README.md](changelog/README.md) — index of the detailed phase notes.

## Per-workspace READMEs

- [`apps/web`](../apps/web/README.md) — Next.js client
- [`apps/api`](../apps/api/README.md) — NestJS API and worker
- [`apps/mobile`](../apps/mobile/README.md) — Expo client
- [`packages/types`](../packages/types/README.md) — shared domain types
- [`packages/api-client`](../packages/api-client/README.md) — typed API client
- [`services/ai`](../services/ai/README.md) — FastAPI service

## Repository-wide policies

- [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md)
- [CONTRIBUTING.md](../CONTRIBUTING.md)
- [SECURITY.md](../SECURITY.md)
- [LICENSE](../LICENSE) (MIT)
- [.env.example](../.env.example) and [.env.production.example](../.env.production.example)
