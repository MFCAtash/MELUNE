# Sonic Canvas — clip export (Phase 10 stretch goal, follow-up)

Phase 10 (`CHANGES-phase10-sonic-canvas.md`) explicitly deferred its
stretch goal to a follow-up pass:

> `canvas.captureStream()` → shareable clip export (listed as a stretch
> goal) — left for a follow-up once the core visual is verified in real
> use; would reuse `ShareCardButton`'s existing button/UI pattern.

This lands that follow-up. No changes to `PlayerEngine`, the audio
graph, playback paths, or any backend code — same constraint every
Phase 10.x pass has kept.

## 1. `SonicCanvas` now forwards its `<canvas>` ref

`sonic-canvas.tsx` switched from a plain function component to
`forwardRef<HTMLCanvasElement, SonicCanvasProps>`. The component's own
draw loop still uses its own internal `canvasRef` exactly as before —
the forwarded ref is only assigned alongside it, in the `<canvas>`
element's `ref` callback. Nothing about sizing, the rAF loop,
`ResizeObserver`, or the reduced-motion/static-frame fallback changed.

This is the first `forwardRef` component in `apps/web` — grepped for
precedent first, found none, so this follows the standard React pattern
(named inner function, so devtools still show `SonicCanvas` instead of
`Anonymous`) rather than inventing a project-specific one.

Existing call sites (`full-screen-player.tsx`'s two pre-existing
`<SonicCanvas>` instances, `persistent-player.tsx` if it renders one)
needed no changes — a component gaining `forwardRef` doesn't change how
callers that don't pass a `ref` behave.

## 2. `<SonicClipButton>` (new component)

- Feature-detects `HTMLCanvasElement.prototype.captureStream` and
  `window.MediaRecorder` before rendering anything — renders `null` if
  either is missing (older Safari, and always in this project's jsdom
  test setup). Same "renders nothing rather than a button that would
  throw" contract `useAudioAnalyser`'s Web Audio guard already
  established for this codebase.
- Takes the live canvas via a `canvasRef` prop (the same node
  `SonicCanvas` is already drawing to every frame, per §1) — never
  creates a second canvas or a second draw loop. Recording the ambient
  (`mode="aurora"`, `variant="ambient"`) instance in
  `full-screen-player.tsx` specifically, not the small `mode="bars"
  variant="compact"` indicator next to the track title, since the
  ambient one is the full-bleed, "one coherent system" visual worth
  sharing — the compact one is a 4-bar VU-meter-sized strip.
- Records for a fixed 5 seconds (`CLIP_DURATION_MS`) via
  `MediaRecorder`, picking the best supported WebM codec
  (`MediaRecorder.isTypeSupported`, vp9 → vp8 → plain `video/webm`),
  then downloads the result — same `createObjectURL` → temporary `<a>`
  → `.click()` → `revokeObjectURL()` sequence `ShareCardButton` already
  uses for its PNG, per the brief's "reusing its button/UI pattern
  rather than adding a new one."
- Disabled (not hidden) while the track is paused: recording 5 seconds
  of a frozen static frame isn't a useful clip, but the capability
  itself is still there — hiding it would make it look unsupported
  rather than "come back once something's playing."
- Cleans up on unmount: if the full-screen player closes mid-recording,
  the in-flight `MediaRecorder` is stopped (rather than left running
  after its owning component is gone), and the already-open
  `MediaStream`'s tracks are always released in `onstop`, whether that
  fires from the 5-second timeout or from this unmount-triggered stop.

## 2a. Self-caught issue while implementing

An early draft called `setIsRecording(false)` unconditionally inside
`onstop`. `onstop` can fire *after* unmount (the cleanup path above
calls `recorder.stop()`, which resolves asynchronously), which would
have logged a React "state update on an unmounted component" warning.
Fixed before landing by gating that one `setState` call on a
`mountedRef` — the download itself (`createObjectURL`/`.click()`) still
runs unconditionally either way, since the click already happened and
the person should still get their file.

## 3. Wiring (`full-screen-player.tsx`)

- Added `sonicCanvasRef` (`useRef<HTMLCanvasElement>(null)`), passed as
  `ref` to the ambient `<SonicCanvas>` and as `canvasRef` to the new
  `<SonicClipButton>`.
- `<SonicClipButton>` placed directly after `<ShareCardButton>` in the
  same action row, wrapped in the same `<span className="text-muted">`
  the row already uses for icon-only buttons — visually just the next
  icon in that row, not a new row or a new interaction pattern.

## 4. Tests

- `sonic-canvas.spec.tsx`: one added case confirming the forwarded ref
  resolves to the actual rendered `<canvas>` element.
- `sonic-clip-button.spec.tsx` (new): renders nothing when
  captureStream/MediaRecorder are unsupported (jsdom's real default —
  not simulated); renders a disabled button once a mock capability is
  installed but the track is paused; and, with fake timers plus a
  minimal `MediaRecorder` stand-in, confirms a click starts capture at
  30fps, disables the button while recording, and — once the 5-second
  timer elapses — triggers exactly one download click, releases the
  captured stream's tracks, and returns the button to its enabled idle
  state.

## Verification note

Same constraint as every other Phase 10.x pass: no network access in
this environment, so `pnpm lint` / `tsc` / `vitest run` were not
actually executed. Reviewed by hand against `use-audio-analyser.ts`'s
existing progressive-enhancement pattern and `ShareCardButton`'s
existing download flow instead. **Please run `npm run lint`, `npm run
typecheck`, and `npm run test --workspace=apps/web` before merging.**
