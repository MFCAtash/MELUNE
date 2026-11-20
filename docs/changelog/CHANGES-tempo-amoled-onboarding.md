# Tempo-Reactive UI + AMOLED mode + swipe onboarding

Three frontend features layered on the existing Sonic Canvas /
Ambient Theme foundations. No backend, recommendation, or
PlayerEngine code was touched.

## 1. Tempo-Reactive UI (beat-synced pulse)

- `hooks/use-beat-pulse.ts` — energy-based beat-onset detection on top of
  `useAudioAnalyser`'s existing bass level (rolling ~0.7s local average,
  relative threshold 1.4x plus an absolute floor, 220ms minimum gap).
  Exposes `pulseRef` (0..1, jumps to 1 on a beat, decays 0.88/frame),
  `reactive`, and a *rough* `bpm` estimate (average inter-onset interval,
  clamped to 60-200). This is a visual flourish, not tempo tracking — see
  the hook's comment for what a real BPM feature would need instead.
- `hooks/use-beat-pulse-style.ts` — applies `pulseRef` to a DOM node every
  frame via a callback held in a ref (no stale closures, no re-renders).
  Resets to pulse=0 once when disabled so a paused UI never stays stuck
  in a brightened/scaled state.
- `components/shell/logo.tsx` — new shared wordmark. Removes the
  duplicated className between `sidebar.tsx` and `topbar.tsx` and adds the
  pulse (brightness + slight scale). Side effect worth knowing: the
  topbar's mobile "MELUNE" text now gets `font-display` like the sidebar's
  (it previously didn't).
- `persistent-player.tsx` — mobile and desktop play buttons pulse
  (glow in the ambient color + slight scale).
- `media-card.tsx` — the album/artist tile that matches the currently
  playing track gets a pulsing ring. "Is this tile playing?" is derived by
  rebuilding `/album/:slug` / `/artist/:slug` from `Song.album` /
  `Song.artist` — no new store state. **Known limit:** a queue started from
  a playlist can't match a playlist tile, because the player store has no
  `sourceId`. Adding one is a separate task; a title-string match was
  rejected as unreliable.
- All of it is skipped under `prefers-reduced-motion` (via the project's
  own `useMediaQuery`, not framer-motion's `useReducedMotion`, matching the
  existing convention for jsdom compatibility) and does nothing when there
  is no real frequency data.

## 2. AMOLED / true-black mode

- `AmbientMode` gains `"amoled"`; cycle order is now
  dynamic → static → system → amoled → dynamic.
- Selecting it sets `<html data-amoled="true">`, forces the dark theme,
  and pins the brand ambient color (same as static). Leaving it clears the
  attribute.
- `globals.css`: `:root[data-theme="dark"][data-amoled="true"]` sets
  background to `0 0 0`, surface `6 6 8`, elevated `14 14 18` — background
  is truly black (largest painted area), surfaces stay slightly above so
  layers remain distinguishable.
- `layout.tsx`: a second no-flash inline script (after the theme one)
  applies the attribute before hydration so reloads don't flash regular dark.
- Toggle icon (`Contrast`) and `ambientModeAmoled` strings in `en`/`fa`.
- Honest caveat: the battery benefit is real only on OLED panels; the
  pixels-lit saving is not measured here.

## 3. Swipe-deck onboarding

- `app/onboarding/page.tsx` — one genre card at a time. Drag right = like,
  left = skip (offset 120px or velocity 600), with a peeking next card.
  Like/Skip buttons are always present, because dragging alone is not
  keyboard-operable. Drag is disabled under reduced motion.
- Exit direction uses `AnimatePresence custom=...` so the *outgoing* card
  flies toward the swiped side (a plain state value would be frozen at the
  card's last render).
- Storage contract (`lib/onboarding.ts`) unchanged; MIN 3 / MAX 5 picks
  unchanged (the cap is enforced quietly — extra likes still advance).
- Summary screen after the deck, with a Restart option.
- Pre-existing gap noticed, not fixed: this page's copy is hardcoded
  English rather than going through i18n.

## Tests

`use-beat-pulse`, `use-beat-pulse-style`, `logo`, `media-card` (now-playing
paths), `ambient-theme-store` (4-mode cycle, DOM sync, forced dark),
`use-ambient-theme` (amoled pins brand color), `ambient-mode-toggle`
(4-step cycle), and `onboarding/__tests__/page.spec.tsx` (deck flow,
Continue gating, persistence, Skip, Restart).

## Verification note

No network in the authoring environment, so `npm install`, lint, typecheck
and the test run were **not executed**. Also, the repo still has no
lockfile while CI uses `npm ci` (see CHANGES-ci-audit-2026-09-27.md).
Run `npm install` (commit the lockfile), then lint, typecheck and
`npm run test --workspace=apps/web` before merging.
