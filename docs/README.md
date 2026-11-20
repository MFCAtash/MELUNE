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
| [project-analysis-fa.md](project-analysis-fa.md) | تحلیل فنی جامع مونوریپو (سند تاریخی ۲۰۲۶-۱۱-۱۸) |

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
