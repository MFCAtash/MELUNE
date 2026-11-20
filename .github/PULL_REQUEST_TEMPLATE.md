## Summary

<!-- One or two sentences: what changed and why. -->

Closes #<issue number>

## Changes

- [ ] <change 1>
- [ ] <change 2>

## Type of change

- [ ] Bug fix (non-breaking)
- [ ] New feature
- [ ] Breaking change
- [ ] Refactor / internal cleanup
- [ ] Documentation
- [ ] Infrastructure / deployment
- [ ] Tests only

## How was this tested?

| Check | Result |
| --- | --- |
| `npm run typecheck` | <!-- pass/fail --> |
| `npm run lint` | <!-- pass/fail --> |
| `npm run test` | <!-- pass/fail --> |
| `npm run build` | <!-- pass/fail --> |
| Manual verification | <!-- screens, flows exercised --> |

If this touches Docker or compose files:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml config
```

## Database migrations

- [ ] Not applicable
- [ ] New migration added (`apps/api/prisma/migrations`)
- [ ] Forward-only; rollback requires a backup restore

## Screenshots / recordings

<!-- Paste before/after images for UI changes. -->

## Checklist

- [ ] I have read [CONTRIBUTING.md](/CONTRIBUTING.md)
- [ ] No secrets, `.env`, dumps or generated media are committed
- [ ] Shared types were updated in `packages/types` rather than duplicated
- [ ] Environment variables added to both `.env.example` and `.env.production.example`
- [ ] Docs updated where behaviour or setup changed
- [ ] Demo accounts and sample data were not modified in a way that hides bugs
