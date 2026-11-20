# Phase 10.1 — Design System tokens + Ambient Theme Engine

> Numbering note: this continues the frontend-upgrade plan's own phase
> numbers (10 = Sonic Canvas, 10.1 = this), a separate track from this
> repo's original roadmap where Phase 10 = mobile app. See the note at
> the top of `docs/design-system.md` for the full explanation.

## 1. Design System reference — `docs/design-system.md`

Formalizes existing, previously-scattered tokens into one documented
set: color (theme-aware + fixed brand + extended palette), motion
durations, elevation/shadow, glass surfaces, z-index scale, typography,
spacing/radius. **Nothing was renamed or replaced** — every existing
`duration-500`, `z-30`, etc. class keeps working exactly as before.
Two small *additive* pieces landed in `tailwind.config.ts` so new code
has names to reach for:

- `transitionDuration`: `quick` (200ms), `base` (300ms), `slow` (500ms),
  `slower` (1000ms) — all values already in use, found via grep across
  `apps/web/src`, not invented.
- `zIndex`: `sticky`(10)/`panel`(20)/`menu`(30)/`overlay`(40)/`player`(50)/
  `modal`(60)/`palette`(70)/`skip`(80) — the existing z-index values
  already formed a clean scale; they just weren't named. Verified by
  grepping every `z-N`/`z-[N]` class in the codebase (see the doc's
  table for exactly which component uses which layer).

## 2. Ambient Theme Engine

Previously: `full-screen-player.tsx` and `app-shell.tsx` each called
`useAmbientColor(coverUrl, seed)` independently, with no user control
and no guard against an extracted color landing near-white/near-black/
fully-gray. This phase adds a controlled layer on top, without changing
`useAmbientColor` itself:

- **`lib/color.ts`** — exported its previously-private `parseColor` and
  `hslToRgb` (already built for the seek-bar gradient) so the new
  ambient-safety code reuses one parser instead of growing a second.
  (This module briefly duplicated `parseColor`'s regex logic in an
  earlier draft of this phase — caught during self-review before
  landing; corrected to import from `lib/color.ts` instead. Noting it
  here since "identify duplication" is one of this project's own
  engineering rules.)
- **`lib/ambient-color-utils.ts`** — `toSafeAmbientColor(raw)`: parses
  whatever `useAmbientColor` returned and clamps saturation to 42–90%,
  lightness to 32–62%. Hue is never touched. Unparseable input (e.g.
  `currentColor`, a CSS variable) is returned unchanged — fails open,
  same philosophy already documented for Redis cache misses elsewhere
  in this project.
- **`store/ambient-theme-store.ts`** — persisted `"dynamic" | "static" |
  "system"` mode, same shape and `zustand/persist` pattern as
  `theme-store.ts`'s light/dark toggle. `cycleMode()` steps
  dynamic → static → system → dynamic, mirroring how repeat-mode
  already cycles in `player-store.ts`.
- **`hooks/use-media-query.ts`** — small reusable `matchMedia` hook
  (guards SSR/jsdom the same way `sonic-canvas.tsx`'s inline
  `prefers-reduced-motion` check already does, Phase 10). Used here for
  `(prefers-contrast: more)`; that inline check in `sonic-canvas.tsx`
  itself was **not** refactored onto this hook in this pass, to keep
  this phase's diff scoped to the Ambient Theme Engine — noted in
  `docs/design-system.md` as a natural follow-up.
- **`hooks/use-ambient-theme.ts`** — the actual pipeline: mode gate →
  (Static, or System + `prefers-contrast: more`) returns the fixed
  brand color `#8B5CF6` **unclamped** (it's already the same known-safe
  color used unclamped on every primary button/badge — clamping it
  would have silently shifted the exact brand hex, which was a bug
  caught in review and fixed before landing); anything else returns
  `toSafeAmbientColor(rawColor)`.
- **`components/shell/ambient-mode-toggle.tsx`** — single-button
  cycle-toggle (`Circle`/`Sparkles`/`Laptop` icons), added to
  `topbar.tsx` next to `ThemeToggle`. Same SSR-hydration guard pattern
  `ThemeToggle` already uses (`mounted` state before trusting the
  persisted value, to avoid a flash-of-wrong-icon on first paint).
- **`full-screen-player.tsx`** / **`app-shell.tsx`** — both now call
  `useAmbientTheme(...)` instead of `useAmbientColor(...)` directly,
  same arguments, so the default ("dynamic") mode reproduces the exact
  behavior they already had, just contrast-clamped.
- **i18n** — `common.ambientMode` / `ambientModeStatic` /
  `ambientModeDynamic` / `ambientModeSystem` added to both `en.ts` and
  `fa.ts` (the `Dictionary` type made a missing key in either a build
  error, not a silent gap).

## 3. Tests

- `lib/__tests__/ambient-color-utils.spec.ts` — clamps near-white,
  near-black, and washed-out-gray inputs into the safe band; leaves an
  already-safe hue/value untouched; fails open on unparseable input;
  preserves alpha when reserializing.
- `store/__tests__/ambient-theme-store.spec.ts` — default mode, explicit
  `setMode`, and the dynamic → static → system → dynamic cycle order
  (including starting from a non-default mode).
- `hooks/__tests__/use-ambient-theme.spec.ts` — dynamic returns a
  clamped `hsl(...)`; static returns the exact brand hex; system matches
  dynamic absent an elevated-contrast preference, and pins the brand hex
  when `matchMedia("(prefers-contrast: more)")` reports `matches: true`.
- `components/shell/__tests__/ambient-mode-toggle.spec.tsx` — renders as
  a single button (not a dropdown); click cycles the store's mode.

## Not done in this pass

- `sonic-canvas.tsx`'s inline `prefers-reduced-motion` check was left
  as-is rather than refactored onto the new `useMediaQuery` hook (see
  above) — deliberate, to keep this diff scoped.
- No mass adoption of the new `duration-*`/`z-*` token names across
  existing components — they're documented and available; existing
  numeric classes were left exactly as they were, per "small, verified,
  incremental" steps.
- Motion durations were **not** also exposed as CSS custom properties
  (only as Tailwind config tokens) — nothing in the codebase currently
  needs them outside Tailwind classes; adding unused CSS variables
  would be speculative, not grounded in an actual caller.

## Verification note

Same as Phase 10: no network access in this environment, so
`npm install` / `npm run lint` / `npm run typecheck` / `npm run test`
could not actually be run here. **Please run `npm run lint && npm run
typecheck && npm run test --workspace=apps/web`** before merging.
