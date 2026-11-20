# @melune/web

The MELUNE web client: a Next.js 14 App Router application with the theme system,
catalog browsing, library features and the queue-based player.

## What's inside

```
src/
  app/                 Route tree (App Router)
    (app)/             Authenticated/player surface: home, search, library,
                       song, album, artist, genre, playlist
    admin/             Catalog editor, analytics, user management
    login, register, forgot-password, reset-password, onboarding
    robots.ts          Crawl rules (blocks /admin, /library, /api, ...)
    sitemap.ts         Dynamic sitemap built from the public catalog
    opengraph-image.tsx Generated OG/Twitter card (edge runtime)
    layout.tsx         Metadata, JSON-LD, RTL/fa-EN locale handling
  components/          admin, auth, home, keyboard, landing, library, player, pwa
  hooks/               Reusable data and UI hooks
  lib/                 API client helpers (server + browser), catalog, site config
  store/               Zustand stores (theme, player, queue)
public/
  audio/, audio-full/  Sample tracks; hero-covers/, covers-real/ artwork
```

## Commands

```bash
npm run dev      # http://localhost:3000
npm run build
npm run start    # production server
npm run lint
npm run typecheck
```

The root package exposes `npm run dev:web` / `build --workspace=apps/web`.

## Configuration

| Variable | Meaning |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Leave **empty** in production so the browser calls `/api/*` same-origin through Caddy. Set it only for cross-origin dev setups. |
| `NEXT_PUBLIC_SITE_URL` | Absolute origin baked into metadata, `robots.txt`, `sitemap.xml` and OG images at build time. |
| `API_INTERNAL_URL` | Server-side API base used by React Server Components (`http://api:4000` in Compose). |

## Conventions worth knowing

- **Server Components talk to the API directly** via `lib/catalog.ts`; that file
  resolves the internal URL and is allowed to fail silently in `sitemap.ts` so a
  booting stack still serves crawlable pages.
- **Theme tokens live in `globals.css`** and are switched by `store/theme-store.ts`.
  Never hardcode colours — use the token classes so all 21 themes stay consistent.
- **RTL is not optional.** Persian is the primary locale; layout direction,
  typography and spacing must hold for both directions.
- **Menus must never sit under hero artwork**: the topbar is a `z-40` sticky layer
  and the hero is an isolated stacking context. Preserve that when changing layout.
- The Home hero is a five-cover cover-flow arc (`components/home/hero-cover-fan.tsx`)
  driven by CSS `data-i` geometry; reduced-motion users get the static arrangement.

## Media

Audio and artwork served from `public/` are bundled sample content (SoundHelix
tracks and generated sleeves). Production media is delivered from object storage;
see `MEDIA_DOMAIN` in the
[deployment guide](../../docs/deploy-oracle-cloudflare.md).

## Tests

`__tests__` directories sit next to the components they cover (admin, onboarding).
Run with the root `npm run test`.
