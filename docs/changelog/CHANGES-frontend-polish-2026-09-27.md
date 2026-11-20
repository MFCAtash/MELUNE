# Frontend polish pass — mini-player visualizer, ambient page headers,
# illustrated empty states (2026-09-27)

Three small, independent frontend-only changes, each reusing existing
tokens/components/hooks rather than adding anything new to the stack.
No changes to `PlayerEngine`, the audio graph, playback paths, the
recommendation services, or any backend/API code.

## 1. Sonic Canvas in the mini-player

`persistent-player.tsx` had no visualizer at all — the old CSS-only
`AudioVisualizer` was never wired in here even before Phase 10 (it was
dead code, only referenced from its own file and from `sonic-canvas.tsx`'s
doc comment). Added the same compact indicator the full-screen player's
title row already uses:

- `useAmbientTheme(track?.coverUrl, …)` — same per-track color pipeline
  `app-shell.tsx` and `full-screen-player.tsx` already call, so the
  mini-player's indicator matches whatever color the rest of the app is
  currently tinted with instead of introducing a second color source.
  Called unconditionally before the component's existing `if (!track)
  return null` (same requirement `app-shell.tsx`'s identical call
  already satisfies).
- `<SonicCanvas isPlaying mode="bars" variant="compact" color={ambientColor}>`
  added to both rows: inline in the mobile bar's title button (after the
  track text, before the button closes) and inline in the desktop bar's
  first grid column (after the title/artist block). Sizes are narrower
  than the full-screen player's `h-4 w-14` (`h-3.5 w-6` mobile, `h-4 w-8`
  desktop) to fit these tighter rows.
- No new AnalyserNode/AudioContext: `useAudioAnalyser` already reads
  from one shared singleton analyser (`lib/audio-analyser-bridge.ts`),
  which is exactly why the full-screen player could already run two
  concurrent `SonicCanvas` instances (compact + ambient aurora) safely —
  this is now a third and fourth (mobile/desktop) concurrent consumer of
  that same shared data, not a new audio-graph attachment.

## 2. Ambient theme on artist/album page headers

Phase 10.1 deliberately scoped ambient color to "a limited, named set of
surfaces" (player backdrop, seek bar, app-wide wash, Sonic Canvas). This
extends that same named set by one entry: the artist and album page
headers, still through the same contrast-safety-clamped
`useAmbientTheme` pipeline — no new color source, no unclamped values.

- `plasma-background.tsx`: added a third `intensity="page"` alongside
  the existing `"full"`/`"ambient"`. Unlike `"ambient"` (`fixed`, whole
  viewport) this is `absolute inset-0`, meant to fill a
  `relative isolate overflow-hidden` container the caller provides, so
  it stays contained to one header block rather than washing the whole
  page. Renders on every breakpoint (a page header has no separate
  mobile layout to protect the way `"full"`'s `lg:block` gate protects
  the full-screen player's desktop-only backdrop). Same
  `aria-hidden`/`pointer-events-none`/`motion-safe:*` guarantees as the
  other two intensities — nothing about those was touched.
- New `components/player/ambient-page-backdrop.tsx` (client component):
  the seam between the server-component pages (`artist/[id]/page.tsx`,
  `album/[id]/page.tsx`, both `async` functions that `await
  catalog.get…` directly) and the `useAmbientTheme` hook. Takes
  `coverUrl`/`seed`, renders nothing but the contained
  `<PlasmaBackground intensity="page">`.
- Both pages: wrapped the existing header `<div>` in
  `relative isolate overflow-hidden rounded-3xl p-6` and dropped
  `<AmbientPageBackdrop>` in as its first child. No other markup in
  either header changed — same `Cover`, same heading structure, same
  spacing between elements, just a contained tinted backdrop and (new)
  padding so the backdrop has room to read before the cover/heading
  content.

## 3. Illustrated empty states

`components/ui/empty-state.tsx` was text-only (title/description/
action) everywhere it was used — 11 call sites across `library`,
`search`, `home`, and `playlist` pages, all sharing one generic dashed-
border box with no visual distinction between "you haven't liked
anything yet" and "we couldn't load this."

- New `components/ui/empty-illustrations.tsx`: one shared
  `IllustrationShell` (a soft blurred color blob behind a `.glass-panel`
  circle — reusing the existing glass-panel surface from
  `docs/design-system.md` rather than inventing a new surface style)
  plus nine small hand-drawn SVG glyphs, each colored from the existing
  extended palette (`tailwind.config.ts`'s `teal`/`rose`/`amber`/
  `indigo`/`lime`, plus `primary`/`accent` — the same tokens already
  reserved for exactly this kind of variety, never touched for primary
  CTAs): liked songs (heart), playlist (stacked rows + plus), saved
  albums (disc in a frame), saved artists (silhouette), search prompt
  (magnifier), search-no-results (magnifier, crossed), empty catalog
  (photo/stack), network error (broken cloud), not-found (disc with
  "?"). All root SVGs are `aria-hidden` — the adjacent heading/
  description text (unchanged) still carries the actual meaning.
- `empty-state.tsx`: added an optional `illustration?: React.ReactNode`
  prop, rendered above the heading. Existing callers that don't pass one
  are visually unchanged — purely additive.
- Wired all 11 call sites: `playlist/[slug]/page.tsx` (not-found,
  empty-playlist), `library/page.tsx` (load-error, empty-playlists,
  no-likes, no-albums, no-artists), `search/page.tsx` (load-error,
  no-results, search-prompt), `home/page.tsx` (load-error,
  empty-catalog).

## Verification note

Same constraint as every other pass in this repo's history: no network
access in this environment, so `pnpm lint` / `tsc` / `vitest run` were
not executed. Reviewed by hand against each of the three areas' existing
patterns (`use-audio-analyser`'s shared-singleton contract,
`useAmbientTheme`'s existing call sites, `EmptyState`'s existing props)
rather than run. **Please run `npm run lint`, `npm run typecheck`, and
`npm run test --workspace=apps/web` before merging** — in particular,
worth eyeballing the artist/album headers at a few viewport widths to
confirm the new `p-6` padding doesn't crowd the cover art on narrow
phones, since neither header previously had page-level padding of its
own beyond the shared `<main>` wrapper.
