# Phase 10.3 — Home Redesign (data-driven only)

Per the brief: reorder/restyle Home using only feeds the API already
returns, never invent a section the backend doesn't support, and reuse
the existing onboarding-fallback pattern for new users rather than
synthesizing fake personalization.

## 0. Ground-truth check before writing anything

The brief lists "genre-based" alongside `madeForYou` / `trending` /
`recentlyPlayed` as if it were a fourth feed the API already returns.
It isn't: `DiscoverService.getHome()` (`apps/api/src/discover/discover.service.ts`)
and the shared `HomeFeed` type (`packages/types/src/index.ts`) only ever
had those first three. There is no genre-grouped endpoint anywhere in
`apps/api/src`.

What *does* already exist: every `Song` the API returns — in all three
of those feeds — carries its own real `genre: Genre | null` field
(catalog data, not something the frontend invents). That's the same
situation `pickTopArtists` in `lib/home.ts` was already built for:
turning data already on hand into a new grouping, with no extra
request and no fabricated relationship. So this phase adds an
equivalent `pickGenreMixes`, and does **not** touch
`discover.service.ts` or add a new endpoint — consistent with "Do not
invent a section unless [the service] already exposes that grouping —
extend the API first if not, and say so as a separate backend task."
Here there's nothing to extend: the grouping key (genre) was already
present per-song, just never grouped. A real backend task would be
useful for the future (a dedicated `/discover/genres` endpoint would
scale better than shipping every song's full genre object three times
over), but is out of scope for this presentation-layer phase and is
flagged here rather than started.

## 1. `pickGenreMixes` (`lib/home.ts`)

- Groups the songs from `trending` + `madeForYou` + `recentlyPlayed`
  (already concatenated on Home as `artistPool`, reused as-is) by
  `song.genre.id`.
- Dedupes by song id first (a song can legitimately appear in more than
  one of those three lists) so a mix's song count means "this many
  distinct songs," not "this many list entries."
- Drops any genre with fewer than 3 distinct songs — a two-song "mix"
  reads as filler, and there's no larger per-genre catalog available
  here to pad it with (see §0; padding it with unrelated songs to hit
  a nicer number would be exactly the kind of fabricated-data shortcut
  the project's core principle rules out).
- Sorted by mix size, capped at 6 by default — same shape as
  `pickTopArtists`'s `limit` param.

## 2. `<GenreMixesShelf>` (new component)

- Horizontal shelf, same scroll/edge-bleed rhythm as the existing
  `SongShelf` (`-mx-4 ... sm:-mx-6 ... lg:mx-0`), so it reads as part
  of the same shelf family rather than a one-off.
- Each card: `coverGradient(genre.id)` for the background — the exact
  function and seed the genre detail page
  (`app/(app)/genre/[id]/page.tsx`) already uses for that genre, so the
  Home card and the page you land on after tapping it are visually the
  same genre, not a re-rolled color.
- Play button queues `mix.songs` (real songs, already fetched) starting
  at index 0, using the same `usePlayerStore` play/pause/queue calls as
  every other Home shelf.
- Renders `null` on an empty mix list (new/empty catalog, or a catalog
  too small to produce a 3+-song genre group) — no placeholder card,
  matching how `SongShelf` and `TrendingPanel` already handle "nothing
  to show."

## 3. Wiring

- Desktop (`home/page.tsx`): added as the last row, after the existing
  `SongShelf`, fed by `pickGenreMixes(artistPool)` — `artistPool` was
  already being built for `TopArtistsPanel`, reused rather than
  recomputed.
- Mobile (`mobile-home.tsx`): appended after the existing filtered
  sections. Computed locally from `data` the same way `homeSections`
  already is in this component, rather than threading a new prop down
  from the page — matches how this component already derives its own
  view state from the raw feed.
- Not added to the mobile filter-chip row (`all` / `trending` / `forYou`
  / `recent`): those chips are typed as `HomeFilter`/`HomeSectionId` and
  drive a single-section-at-a-time view; folding N dynamic genres into
  that enum would be a bigger structural change than "polish," so genre
  mixes sit outside the chips as their own always-visible section,
  the same way the "Now trending" carousel already sits outside them.

## 4. i18n

- Added `home.genreMixes` to both `en.ts` and `fa.ts` (Persian), kept in
  the same position in both files per this project's `Dictionary`
  contract. No RTL-specific handling needed — the shelf already uses
  logical `overflow-x-auto` scrolling and no hardcoded `left`/`right`
  (the play button's `right-3` matches the existing `SongCard`'s
  same-side placement in `song-shelf.tsx`, so it wasn't singled out for
  a logical-property fix here).

## 5. Tests

- `lib/__tests__/home.spec.ts`: added a `pickGenreMixes` describe block
  — groups + drops under-sized genres, dedupes a repeated song id
  across lists, and sorts/limits by mix size. Extended the existing
  `song()` test helper with an optional `genre` param (defaults to
  `null`, so every pre-existing call site is unaffected).
- No new tests added for `<GenreMixesShelf>` itself or for the two call
  sites in `page.tsx` / `mobile-home.tsx` — both are thin wiring around
  already-tested pieces (`pickGenreMixes`, `usePlayerStore`,
  `useTranslation`, `Cover`/`coverGradient`), matching this project's
  existing test boundary (e.g. `TrendingPanel` and `SongShelf` also have
  no dedicated component specs; the logic they call does).

## 6. Explicitly not done in this phase (per the brief)

- No "Because You Listened To X" section — `DiscoverService` doesn't
  group `madeForYou` by seed track/artist, and building that grouping
  would require backend changes, which the brief says to flag instead
  of fake it. Flagged, not started.
- No changes to the empty/new-user state — `home/page.tsx` already
  falls back to the onboarding-seed mix
  (`useOnboardingSeedSongs`)/`EmptyState` for a brand-new account with
  no history, which is exactly the "reuse the existing
  onboarding-fallback pattern, never synthesize fake personalization"
  the brief asks for. `pickGenreMixes` degrades the same way: a
  brand-new account's thin `artistPool` just yields fewer (or zero)
  genre mixes rather than being backfilled with unrelated songs.

## Verification note

Same constraint as Phase 10.2: no network access in this environment,
so `pnpm lint` / `tsc` / `vitest run` were not actually executed here.
Reviewed by hand against the existing patterns (`pickTopArtists`,
`SongShelf`, `TrendingPanel`) and the shared `Dictionary`/`Song`/`Genre`
types instead.
