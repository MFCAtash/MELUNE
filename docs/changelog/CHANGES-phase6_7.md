# Phase 6.6 — Typography, next/image, extended palette

## Fonts
- next/font/google: Sora (display: headings/logo, weights 600/700/800),
  Inter (body, Latin), Vazirmatn (Persian, weights 400-800) — loaded as
  CSS variables `--font-display` / `--font-sans` / `--font-fa` on <html>.
- tailwind.config.ts: `fontFamily.display` / `.sans` / `.fa`.
- globals.css: body defaults to `font-sans`; `html[dir="rtl"] body` swaps
  to Vazirmatn; h1–h4 and `.font-display` use the display font everywhere
  automatically, no per-component class needed except the two literal
  "CODEX MUSIC" wordmarks (sidebar, landing header).

## next/image
- next.config.js: `remotePatterns` widened to `{ protocol: "https",
  hostname: "**" }` — coverUrl is an arbitrary external URL
  (`@IsUrl()` on the API, no fixed Storage domain yet), so a fixed
  allowlist would break on real content.
- components/ui/cover.tsx, components/player/vinyl-cover.tsx,
  components/player/full-screen-player.tsx: raw `<img>` → `next/image`
  with `fill` + `sizes`, keeping the existing blur-up / onError-to-
  gradient behavior.
- apps/web: added `sharp` dependency (required for next/image's
  optimizer in the self-hosted production Docker build).

## Extended color palette
- lib/cover.ts: PALETTES grown from 8 to 12 (added amber→rose,
  lime→teal, cyan→indigo, amber→violet) so cover grids read as more
  varied.
- tailwind.config.ts: named tokens `teal`, `rose`, `amber`, `indigo`,
  `magenta`, `lime` for chips/badges outside the primary/accent brand
  pair.
- Genre page: title gradient is now per-genre (hashed via
  `coverGradient(genre.id)`) instead of the fixed brand gradient reused
  on every page.

# Phase 6.7 — Drag-to-reorder, onboarding, global command palette, PWA, light/dark theme

## Drag-to-reorder (playlists)
- TrackList (`default` variant) accepts a new `onReorder(newOrder)` prop:
  native HTML5 drag-and-drop with a grip handle per row, drop-target
  highlight, and full reordering. The existing keyboard-accessible
  up/down/remove buttons stay — drag is additive.
- Playlist page wires `onReorder` to the existing `useReorderPlaylist`
  mutation (optimistic, already built against `PATCH
  /playlists/:id/songs/reorder`).

## Onboarding (post-signup genre picks)
- New `/onboarding` page: pick 3–5 genres (from `GET /genres`, now
  exposed as `catalog.listGenres()`), or skip.
- `register/page.tsx` redirects new accounts through `/onboarding`
  (forwarding the original `?next=`) instead of straight to `next`.
- No `/users/me/preferences` endpoint exists yet, so picks are stored
  client-side (`lib/onboarding.ts`, localStorage) and used only as a
  *fallback*: `useOnboardingSeedSongs` builds a genre-mix client-side
  and Home only reaches for it when the real history-based
  `madeForYou` comes back empty. Real history always wins.

## Command palette → global commands
- Command-K is no longer search-only: a "Quick actions" section (Home /
  Search / Library / New playlist / toggle theme / log in-out) is
  always available, keyboard-navigable alongside search results, and
  filters by label while typing (typing "theme" surfaces the toggle
  next to any matching songs).
- `ui-store`: playlist-creation dialog state moved from local
  `AppShell` state to the store (`createPlaylistOpen` /
  `openCreatePlaylist` / `closeCreatePlaylist`), so both the sidebar
  button and the command palette's "New playlist" action open the same
  dialog.

## PWA / offline app shell
- `public/manifest.webmanifest` + generated icons (`public/icons/`,
  192/512/maskable/apple-touch) — installable on Android/desktop/iOS.
- `public/sw.js`: hand-rolled service worker (no Workbox/next-pwa, since
  Next's hashed build filenames aren't known ahead of a real `next
  build`). Network-first navigations with a cached-page fallback, then
  `public/offline.html`; stale-while-revalidate for `/_next/static/`,
  `/icons/`, `/fonts/`. Deliberately does NOT cache API responses or
  external cover/audio URLs — this makes the *app shell* open offline,
  it does not enable offline listening (that needs first-party audio
  hosting, i.e. the Storage phase, which still doesn't exist).
- Registered client-side (`components/pwa/sw-register.tsx`), production
  builds only.

## Light/dark theme toggle
- Was previously dark-only (`className="dark"` hardcoded, all color
  tokens fixed hex). `background` / `surface` / `surfaceElevated` /
  `foreground` / `muted` / `border` are now CSS variables
  (`rgb(var(--color-x) / <alpha-value>)`, opacity-modifier compatible)
  switched by `[data-theme]` on `<html>` — see globals.css. Brand colors
  (primary/accent/ember/extended palette) and anything painted
  `text-white` *on* a brand-colored surface (buttons, badges, the vinyl
  label) stay fixed across themes on purpose.
- `store/theme-store.ts` (persisted) + a no-flash inline script in
  `layout.tsx` (same pattern as the existing locale switcher) + a
  `ThemeToggle` button in the topbar.
- ~90 `text-white` occurrences across 36 components were audited and
  converted to the theme-aware `text-foreground` token; the ~20 that
  sit on a fixed brand-colored background were deliberately left
  `text-white`. Not converted: the persistent/full-screen player's
  seek-bar track and a few decorative rgba(black) scrims — the player
  surface stays dark-themed regardless of app theme (mirrors Spotify/
  Apple Music), a deliberate scope cut, not an oversight.
