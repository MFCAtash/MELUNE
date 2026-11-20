# Phase 10 — Sonic Canvas (real, audio-reactive visualizer)

Replaces the previous CSS-only `AudioVisualizer` — which only ever knew
`isPlaying`, never the actual sound — with a real, frequency-reactive
generative visual. This is the flagship differentiator for this phase:
nothing here is a preset animation loop; every mode reads live frequency
data from whatever is actually playing.

Per the brief: no existing playback logic, recommendation code, or other
working feature was touched. Everything below is additive.

## 1. Shared Web Audio bridge — `lib/audio-analyser-bridge.ts`

- Module-level singleton, not a hook, because
  `AudioContext.createMediaElementSource(el)` may only ever be called
  **once** for a given `<audio>` element for the page's lifetime — a
  second call (e.g. the full-screen player closing/reopening) throws
  `InvalidStateError`. The graph (`AudioContext` → `MediaElementAudioSourceNode`
  → `AnalyserNode` → `ctx.destination`) is built lazily, exactly once,//
  the first time anything asks for data, and reused for the rest of the
  session.
- `registerPlayerAudioElement(el)` — called by `PlayerEngine` on
  mount/unmount. Pure registration: doesn't touch `src`, `play()`,
  `pause()`, volume, or anything else about how the element loads or
  plays audio. Every existing playback path (offline IndexedDB blobs,
  HLS via hls.js, direct-file fallback, Safari native HLS) is untouched.
- Deliberately does **not** set `audio.crossOrigin` — doing so on an
  element that already has a `src` re-triggers resource selection
  (i.e. would restart whatever's currently playing), which the brief
  explicitly rules out. Instead: if the current track's audio is
  cross-origin without CORS headers (the same open question already
  noted for cover-art canvas export in `share-card-button.tsx`), the
  browser silently "taints" the graph — playback is completely
  unaffected, but `AnalyserNode` reads come back as all-zero. This is
  handled as data, not a special case (see below).
- `isAnalyserPermanentlyUnavailable()` — true once a build attempt has
  been made and failed for good (no Web Audio support at all). Lets
  callers stop polling forever instead of spinning a rAF loop with no
  possible outcome.
- `resumeSharedAudioContext()` — autoplay-policy-safe: contexts can
  start (or drop back into) `"suspended"`; safe to call anytime, no-op
  if already running.

## 2. `hooks/use-audio-analyser.ts`

- Exposes live bass/mid/treble/overall levels via a **ref**, updated on
  every animation frame — never React state, so 60fps updates don't
  cause 60fps re-renders. Consumers read `levelsRef.current` inside
  their own rAF loop.
- `reactive` (state, changes rarely) flips to `false` when: Web Audio
  isn't supported at all, the audio graph is CORS-tainted (sustained
  all-zero frequency data for ~1.5s of active playback), or the
  `AudioContext` never resumes. One fallback path for all three causes,
  because the correct behavior — degrade to a non-reactive visual — is
  identical regardless of *why* real data isn't available.
- Unit tests (`hooks/__tests__/use-audio-analyser.spec.ts`): zeroed
  levels + `reactive: true` while paused; falls back to
  `reactive: false` once Web Audio is confirmed unavailable (true in
  jsdom, exercising the exact same code path a real CORS-tainted
  session would hit); clean unmount with no dangling rAF.

## 3. `components/player/sonic-canvas.tsx`

Canvas 2D (no WebGL/three.js dependency — none of these modes need it),
five modes:

- **Bars** — spectrum bars mapped bass→mid→treble across the bar range;
  replaces the old 4-bar CSS indicator 1:1 in `variant="compact"`.
- **Wave** — a single reactive waveform, amplitude driven by overall
  level, secondary wobble driven by treble.
- **Aurora** — the audio-reactive counterpart to the existing static
  `PlasmaBackground`: soft radial-gradient blobs (not `ctx.filter: blur`,
  which isn't reliably supported everywhere — same reasoning as the
  Firefox `::-moz-range-progress` note in `CHANGES-phase8_2-ui-review.md`)
  pulsing with bass/mid.
- **Particles** — bass-onset detection (a sharp rise, not every frame)
  spawns a small upward-drifting burst; capped pool size, not unbounded.
- **Minimal** — a single pulsing circle scaled by overall level.

Shared behavior across all modes:
- Colored from the same per-track `ambientColor` already computed by
  `useAmbientColor` — one coherent system with the existing ambient
  background/seek-bar, not a bolted-on separate effect.
- `prefers-reduced-motion`: renders one static frame (mirroring the old
  visualizer's idle look) and never starts the rAF loop — same pattern
  `PlasmaBackground` already uses, just done in JS since Canvas 2D has
  no CSS-only equivalent to `motion-safe:`.
- Low-power mode: measured, not device-sniffed — if recent frame times
  average under ~30fps, bar/particle counts drop for the rest of the
  session.
- Falls back to the same static frame whenever `useAudioAnalyser`
  reports `reactive: false`, or when `isPlaying` is false.
- In an environment with no 2D canvas context (also true of jsdom in
  tests) the effect bails out before touching `ResizeObserver` or
  `requestAnimationFrame` at all — nothing to poll for, nothing thrown.

## 4. Wiring — `full-screen-player.tsx`

- Compact bars mode replaces `<AudioVisualizer isPlaying={isPlaying} />`
  in the title row, same footprint (`h-4`). `audio-visualizer.tsx` is
  left in place (now unused, not deleted) rather than removed as part
  of this pass — nothing currently imports it.
- A new `variant="ambient"` Aurora layer sits in the existing backdrop
  `<div>`, alongside (not replacing) `PlasmaBackground` — this is the
  "flagship feature" placement: real frequency data behind the artwork,
  not a preset animation.
- Mini-player (`persistent-player.tsx`) is untouched — it never used
  `AudioVisualizer` to begin with, so there was nothing to swap there.

## 5. Tests

- `lib/__tests__/audio-analyser-bridge.spec.ts` — no-registration and
  no-Web-Audio-support paths never throw; permanent-unavailability
  reporting is correct; `resumeSharedAudioContext` is a safe no-op.
- `hooks/__tests__/use-audio-analyser.spec.ts` — see above.
- `components/player/__tests__/sonic-canvas.spec.tsx` — mounts/unmounts
  cleanly across all five modes and both playing states, renders a real
  `<canvas>`, keeps the decorative `aria-hidden` contract the old
  visualizer had.
- Pre-existing `full-screen-player.spec.tsx` needed no changes — it
  never asserted against the old `AudioVisualizer` directly.

## Not done in this pass (by design — see the phase plan)

- `canvas.captureStream()` → shareable clip export (listed as a stretch
  goal) — left for a follow-up once the core visual is verified in
  real use; would reuse `ShareCardButton`'s existing button/UI pattern.
- No changes to `recommendations.service.ts`, `collaborative.service.ts`,
  or any backend code.

## Verification note

This environment has no network access, so `npm install` / `npm run
lint` / `npm run typecheck` / `npm run test` could not actually be
executed here. All new code was written and manually re-read against
the existing patterns in this codebase (ref-based rAF loops, optional
`ResizeObserver`/`matchMedia` guards for jsdom, the project's existing
vitest conventions). **Please run `npm run lint`, `npm run typecheck`,
and `npm run test --workspace=apps/web` in your own environment before
merging**, per the project's own engineering rules.
