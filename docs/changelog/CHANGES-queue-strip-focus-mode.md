# Queue color strip + Focus Mode

Two frontend features on top of the Ambient Theme / Sonic Canvas
foundations. No backend, PlayerEngine or player-store code was touched.

## 4. Queue color strip

A thin horizontal bar (`components/player/queue-color-strip.tsx`) that
shows the "mood" of what plays next without opening the queue: one
segment per upcoming track, tinted with that track's real ambient color.

- **Where it shows:** top edge of the persistent player (mobile + desktop),
  inside the queue panel, and above the "Up next" list in the full-screen
  player. It renders nothing until at least one track is queued after the
  current one.
- **What it shows:** the current track (segment fills with playback
  progress), up to 2 already-played tracks (dimmed), up to 8 upcoming
  tracks. Segment width follows track length (clamped 60-600s, 180s if the
  duration is missing). A faint cap at the end means more tracks are queued
  beyond the window. It is informational only — not focusable/clickable.
- **Data:** no new data. Colors come from the same artwork -> color
  pipeline as the playing track:
  - `lib/track-color.ts` (new) — the fallback hash and canvas extraction
    moved out of `use-ambient-color.ts` into plain functions plus a small
    memoizing loader (200-entry cache, in-flight de-dupe, never rejects).
    Upcoming covers are decoded once and reused when they become current.
  - `hooks/use-ambient-color.ts` — now a thin wrapper over that loader
    (same behavior for callers).
  - `lib/ambient-color-utils.ts` — `resolveAmbientColor` (mode gate +
    contrast clamp as a pure function) and `BRAND_STATIC_COLOR`;
    `use-ambient-theme.ts` uses it, so behavior is unchanged.
  - `hooks/use-queue-colors.ts` (new) — the same pipeline for a list of
    tracks. Respects Static / System / AMOLED: in those modes every segment
    is the brand color (the strip then works as a plain queue timeline).
- `lib/queue-strip.ts` holds the windowing/weighting rules as pure functions.
- Only the current segment's fill subscribes to `currentTime`, so playback
  ticks don't re-render the strip or redo any color work.
- Color transitions are `motion-safe:` only. Strip has `role="img"` and a
  label (`queue.colorPreview`, en + fa).

## 5. Focus Mode

`components/player/focus-mode.tsx` — full-screen view with a big study
timer and one pause/play button. Nothing else moves.

- **Entry:** button in the full-screen player's action row, button in the
  desktop player bar (left of the queue button), and the `T` shortcut
  (listed in the shortcuts dialog). It needs a current track. Opening it
  closes the full-screen player and queue panel (`ui-store.openFocusMode`),
  so exiting returns to the app. Exit: X button or Escape.
- **Off / still by construction:** no Sonic Canvas, no PlasmaBackground, no
  cover art, and the component never calls `useAmbientTheme`, so it looks
  identical in Dynamic, Static, System and AMOLED (background is the plain
  theme `bg-background`; true black under AMOLED; accent is the fixed brand
  color, not the track color). While it is open:
  - `AppShell` unmounts the animated app-wide PlasmaBackground;
  - `PersistentPlayer` stops the beat pulse and the compact Sonic Canvas
    indicators instead of animating behind an opaque overlay.
  The only motion is a one-shot 250ms fade in/out, dropped under
  `prefers-reduced-motion`.
- **Timer:** stopwatch by default; a small low-emphasis control cycles
  stopwatch -> 25 -> 45 -> 60 min countdown (changing length restarts the
  clock), plus a reset button. "Paused" / "Session complete" captions.
  The timer **only runs while music is playing**, so pausing the music
  pauses the study clock. Time is accumulated from `Date.now()` deltas, so
  background-tab timer throttling doesn't lose minutes. The session belongs
  to the view: closing Focus Mode ends it.
- **Extras:** Screen Wake Lock while open (`hooks/use-wake-lock.ts`, no-op
  where unsupported) so the display doesn't dim mid-session; focus moves
  into the dialog on open and is restored on close.
- **Shortcuts:** while Focus Mode is open `Q` and `F` do nothing (they would
  open panels hidden underneath it); play/pause, seek, volume, next/previous
  still work. If the queue empties while it is open it closes itself.
- i18n: `focus.*` section and `shortcuts.toggleFocusMode` in en + fa.

## Tests

`queue-strip`, `track-color`, `focus-timer`, `resolveAmbientColor` (added to
`ambient-color-utils.spec`), `use-focus-timer`, `use-queue-colors`,
`ui-store` (focus mode + Escape order), `queue-color-strip` (component),
`focus-mode` (component), and the `T` shortcut in `shortcuts.spec`.

## Verification note

No network in the authoring environment, so `npm install`, lint, typecheck
and the vitest run were **not executed**. The pure logic (`queue-strip`,
`focus-timer`, `track-color` fallback path) was smoke-run directly with
Node and behaves as the specs expect. Run `npm install`, then lint,
typecheck and `npm run test --workspace=apps/web` before merging.

## Known limits / choices worth a look

- The mobile mini-player has no Focus button of its own (no room in that
  row); on phones it is reached from the full-screen player.
- Focus Mode's timer is tied to playback by design. If you would rather have
  an independent wall-clock timer, change `useFocusTimer(isPlaying)` in
  `focus-mode.tsx` to `useFocusTimer(true)`.
- Beat-pulse loops on the sidebar logo and media cards still run beneath the
  overlay (invisible, cheap); only the player-bar visuals and the app wash
  are stopped.

## Review pass (2026-09-28)

Independent read-through of the two features above, plus what could be
executed offline (no npm registry, so vitest/next/eslint still could not run).

Checked and found correct:
- `lib/queue-strip.ts`, `lib/focus-timer.ts`, `lib/track-color.ts` type-check
  under `tsc --strict`; `queue-strip.spec.ts` (9 cases) and
  `focus-timer.spec.ts` (6 cases) pass when run through a minimal vitest shim;
  edge cases (last track, no current track, out-of-range index, zero/NaN
  duration, over-long tracks) behave as documented.
- en/fa dictionaries have identical key sets (297 each) and every literal
  `t("…")` key used in the source (242) exists; interpolation names match
  (`{{minutes}}`).
- All workflow/action/dependabot YAML parses; package/eslint JSON parses;
  `scripts/*.mjs` and `*.sh` pass `node --check` / `bash -n`.

Fixed:
- **`hooks/use-wake-lock.ts` leaked a screen wake lock.** If the tab became
  visible again while the first `wakeLock.request()` was still pending, both
  requests resolved into the same `sentinel` variable and the earlier one was
  overwritten without being released — it then kept the screen awake even
  after Focus Mode closed. Reproduced against the original code (second
  sentinel never released, even after unmount) and confirmed fixed; the
  replaced sentinel is now released when it is overwritten. Covered by the new
  `hooks/__tests__/use-wake-lock.spec.ts`.

Left as-is (design choices, flagged in case you disagree):
- The Focus Mode timer only runs while music is playing (documented above).
- `focus-mode.tsx` uses `z-[55]` rather than a named token from the z-index
  scale in `docs/design-system.md`.
- `useQueueColors` keeps every resolved color in component state for the
  life of the strip (a few dozen bytes per track); the module-level cache is
  capped at 200 entries, the per-component map is not.

Still open (needs a networked machine, unchanged by this pass):
- `package-lock.json` does not exist yet — run `npm run lockfile:generate`
  or the "Generate lockfile" workflow. Until then `npm run lockfile:check`
  reports it missing (CI falls back to `npm install` with a warning).
- Nothing here has been run under vitest, ESLint, `tsc` for the whole
  workspace, `next build`, or Docker.
