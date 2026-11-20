# Phase 10.2 — Player Polish (no engine changes)

Per the brief: no changes to `PlayerEngine`, the audio graph, playback
paths, recommendations, or any backend code. Everything below is
presentation-layer polish on top of what Phase 10 (Sonic Canvas) and
Phase 10.1 (Design Tokens + Ambient Theme) already landed.

## 1. Shared-element transition — mini-player ↔ full-screen player

Previously `FullScreenPlayer` was a hard `{showFullScreen && <FullScreenPlayer />}`
mount/unmount with no entrance or exit animation at all.

- `persistent-player.tsx` now wraps that conditional in framer-motion's
  `AnimatePresence`, so the exit animation below actually gets to play
  before the component unmounts.
- `full-screen-player.tsx`'s root `<div role="dialog">` is now a
  `motion.div` with a spring fade/slide-up on enter and the mirrored
  animation on exit (`reduceMotion` skips both — see §4).
- The actual "shared-element" part: the mini-player's mobile cover art
  (`persistent-player.tsx`) and the full-screen player's mobile cover
  art (`full-screen-player.tsx`) both carry `layoutId={`np-cover-${track.id}`}`.
  Framer Motion detects the two elements with a matching `layoutId` and
  morphs one into the other's size/position instead of a cut — this is
  the "feels premium" moment called for in the brief, using the actual
  track's artwork, not a placeholder.
- Scoped to the mobile artwork tile specifically (both the mini-player's
  and the full-screen player's mobile-only elements are `sm:hidden`),
  since that's the only pairing that's the *same shape* on both ends —
  the desktop `VinylCover` is circular vinyl styling, a different visual
  language, and was left untouched rather than force a mismatched morph.
  Desktop still has no way to open the full-screen player from the bar
  (pre-existing — the desktop bar links to `/song/[slug]` instead); not
  changed here, out of scope for a "polish" pass.
- Mini-player's `QueuePanel` was **not** wrapped in the same
  `AnimatePresence` — deliberately scoped to `FullScreenPlayer` only,
  per "small, verified, incremental."

## 2. Spring hover/press states — MediaCard & SongRow

- `components/library/media-card.tsx` (the shared grid tile used for
  playlists, albums *and* artists — this codebase doesn't have separate
  Album/Song/Artist card components) now wraps its content in a
  `motion.div` with `whileHover`/`whileTap` on one shared spring
  constant (`cardSpring`), instead of the old plain `hover:bg-surface`
  CSS transition. The outer `<Link>` keeps its `group`/padding/role so
  the existing `media-card.spec.tsx` assertions (role, href, text)
  needed no changes.
- `components/home/song-row.tsx` (the mobile song-list row — the
  closest thing to a "SongCard" in this codebase; `TrackList`'s `rich`
  variant is a denser desktop table and was left as-is to keep this
  diff scoped) gets a `whileTap` press-scale on the whole row via
  `motion.li`.
- Both gate on the project's own reduced-motion check (see §4) rather
  than framer-motion's built-in one.

## 3. Lyrics rendering polish (no fake sync data)

`mockLyricsProvider` is untouched — still the same placeholder lines
from `lib/contracts/lyrics.ts`, per the brief's explicit instruction not
to fake real synced lyrics. Only how the existing lines are *rendered*
changed:

- Each lyric `<p>` now holds a ref; a `useEffect` keyed on
  `activeLyricIndex` calls `scrollIntoView({ block: "center" })` on the
  active line whenever it changes, so the reader doesn't have to
  manually scroll to follow along. `behavior` is `"auto"` instead of
  `"smooth"` when reduced-motion is set.
- The active line now gets a distinct size/weight (`text-xl
  font-semibold`) versus inactive lines (`text-lg text-muted`), with a
  `scale-105` bump and a 300ms transition, instead of only a color
  change before.
- Caught during implementation: the auto-scroll `useEffect` and the
  `activeLyricIndex` calculation it depends on both need to run
  *before* this component's existing `if (!track) return null;` early
  return — every other hook in this component already does. An earlier
  draft placed the new effect after that return, which would have
  violated the rules of hooks (conditionally skipping a hook). Fixed
  before landing; noted here per this project's own practice of
  surfacing self-caught issues in the changelog rather than silently
  fixing them.

## 4. Reduced-motion: reused the project's own hook, not framer-motion's

All three of the above gate on `useMediaQuery("(prefers-reduced-motion: reduce)")`
from `hooks/use-media-query.ts` (built in Phase 10.1) — **not**
framer-motion's built-in `useReducedMotion()`. Framer-motion's version
calls `window.matchMedia` unconditionally the first time it's used;
`window.matchMedia` is `undefined` in this project's jsdom test setup
(no polyfill in `vitest.setup.ts`), which is exactly why
`use-media-query.ts` and `sonic-canvas.tsx`'s inline check already guard
`typeof window.matchMedia !== "function"` before calling it. Using
framer-motion's hook directly would have thrown in every test that
renders `MediaCard`, `SongRow`, or `FullScreenPlayer` — caught and
corrected before landing, not discovered via a failing test run (no
network access here to actually run the suite — see the verification
note below).

## 5. Tests

- `full-screen-player.spec.tsx` — added a case asserting the active
  lyric line's element (specifically, the line that becomes active once
  `currentTime` advances past its timestamp) is the one passed to
  `scrollIntoView`, with `HTMLElement.prototype.scrollIntoView` stubbed
  (jsdom doesn't implement it). All pre-existing cases in this file
  needed no changes — none of them asserted against the old plain
  `<div>` root or the old `<span>` cover wrapper directly.
- No new test files for `media-card.tsx` or `song-row.tsx` in this pass:
  the existing `media-card.spec.tsx` cases already exercise the
  reduced-motion code path end-to-end (they'd have failed immediately
  if `useMediaQuery` threw), and `song-row.tsx` had no prior test
  coverage to extend. Adding one from scratch — with the
  `LikeButton`/API-client mocking that would require, following the
  pattern in `full-screen-player.spec.tsx` — is a reasonable follow-up
  but was left out to keep this diff scoped to the brief's three bullet
  points.

## Not done in this pass

- No shared-element trigger was added to the desktop player bar (see
  §1) — desktop has no full-screen-player entry point at all today,
  and adding one wasn't asked for in this phase.
- `TrackList`'s `rich`/`default` desktop row variants were not given
  the same spring hover treatment as `SongRow` — scoped out to keep
  this pass to the two components the brief named.
- The lyrics container's padding wasn't adjusted to let the very first
  or last line scroll to true vertical center (a common karaoke-view
  refinement) — `scrollIntoView({ block: "center" })` still works
  correctly for every line in between; edge lines just can't fully
  center against the panel's fixed height. Minor, and safer to leave
  for a follow-up than hand-tune padding against a placeholder lyric
  set that's going to be replaced anyway.

## Verification note

Same as Phases 10 and 10.1: no network access in this environment, so
`npm install` / `npm run lint` / `npm run typecheck` / `npm run test`
could not actually be run here. All new code was re-read against this
component's existing hook ordering, the project's reduced-motion
convention, and its vitest patterns. **Please run `npm run lint && npm
run typecheck && npm run test --workspace=apps/web`** before merging.
