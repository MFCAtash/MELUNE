# Phase 8.2 UI review follow-up — app-wide plasma, gradient seek bar, reactive play button

Addresses three specific review notes on `CHANGES-phase8_1.md`'s
Plasma UI and player controls. (Named separately from
`CHANGES-phase8_2.md`, which already covers this phase's
recommendation engine + admin panel work.)

## 5. Plasma across the whole app (not just the player)
`components/player/plasma-background.tsx`'s original scope (desktop
only, `FullScreenPlayer`'s backdrop only) was intentional for 8.1, not
a bug — but the reference designs show the gradient wash across the
whole screen, so it's now parametrized:

- `PlasmaBackground` takes an `intensity: "ambient" | "full"` prop.
  - `"full"` is the unchanged 8.1 behavior: `hidden lg:block`, opacity
    25-30%, absolutely positioned inside `FullScreenPlayer`'s own
    backdrop `div`. `FullScreenPlayer` didn't change at all here.
  - `"ambient"` is new: `fixed inset-0 -z-10` (so it sits behind the
    whole shell regardless of scroll), visible at every breakpoint,
    opacity dropped to 10-12%.
- `components/shell/app-shell.tsx` renders one `"ambient"` instance
  at the root, behind `children`, alongside (not replacing) the
  existing static `bg-app-glow` wash.
- Colored from the same currently-playing track as the full-screen
  player, via the existing `useAmbientColor` hook — when the track
  changes, the whole app's background tint now drifts along with it,
  not just the player's. No track playing → falls back to the hook's
  own deterministic hash color (seed `"codex-app-ambient"`), same
  pattern the full-screen player already uses for "no track"
  gracefully.
- The accessibility guardrails from 8.1 are unchanged and apply to
  both intensities: `aria-hidden`, `pointer-events-none`, and
  animation gated behind `motion-safe:` (i.e.
  `prefers-reduced-motion: no-preference`) with no separate JS check.

## 6. Gradient seek bar + bigger play button
Both hard-coded (flat `#8b5cf6`, static `shadow-glow`) per the review;
now driven by the track's ambient color where that color is already
available (`FullScreenPlayer`).

- **Seek bar** (`globals.css` + `seek-bar.tsx`): the WebKit track
  gradient now reads `--seek-color-start` / `--seek-color-end`
  (defaulting to the old `#8b5cf6` / `#ec4899`, so every other caller
  of `SeekBar` — the compact desktop bar, mobile — is visually
  unchanged). `SeekBar` gained an optional `ambientColor` prop; when
  passed, it sets both variables (`end` via a new `lib/color.ts`
  `lighten()` helper, +20 lightness) as inline style. Only
  `FullScreenPlayer` passes it for now. Firefox's
  `::-moz-range-progress` can't paint a multi-stop gradient, so it
  only picks up the start color — still reacts per-track, just not
  the second stop. Thumb glow now also reads `--seek-color-start` via
  `color-mix()` instead of a fixed rgba purple.
- **Play button** (`full-screen-player.tsx`): the modal's central
  play/pause button — `h-16 w-16` with a static `shadow-glow` — is
  now `h-14 w-14` with `shadow-[0_0_28px_var(--ambient-color)]`,
  `--ambient-color` set inline from the same `ambientColor` the
  backdrop and (now) the seek bar use. `persistent-player.tsx`'s two
  buttons (`h-10 w-10` mobile mini-player, `h-8 w-8` desktop bar) are
  untouched, per the review's explicit "don't touch the mini-player"
  note.

## New file
- `lib/color.ts`: `lighten(color, amount)` — parses `hsl()`, `rgb()`/
  `rgba()`, and hex, lightens by `amount` percentage points, and
  returns unrecognized formats unchanged rather than throwing (so an
  unexpected color format degrades to "no lighten" instead of a
  crash).

## Explicitly out of scope this pass
- Extending `ambientColor` into `persistent-player.tsx`'s compact
  seek bar / buttons — the review scoped the seek-bar/play-button
  change to the full-screen player specifically and asked that the
  mini-player stay as-is; left for a follow-up if the app-wide
  reactive-color treatment should reach the persistent bar too.
