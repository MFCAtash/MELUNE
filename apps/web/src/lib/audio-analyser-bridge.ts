/**
 * Phase 10 — Sonic Canvas: a singleton bridge between the single,
 * persistent <audio> element `PlayerEngine` owns (mounted once in the
 * root layout — see docs/architecture.md's "Music player" section) and
 * a Web Audio `AnalyserNode`.
 *
 * Why a singleton, not something built per-component-instance:
 * `AudioContext.createMediaElementSource(el)` may only ever be called
 * ONCE for a given <audio> element for the lifetime of the page — a
 * second call (e.g. the full-screen player closing and reopening, which
 * unmounts/remounts anything reading analyser data) throws
 * `InvalidStateError`. So the graph is built lazily, exactly once, the
 * first time anything asks for analyser data, and reused for the rest
 * of the session.
 *
 * Deliberately does NOT set `audio.crossOrigin`, does NOT change `src`
 * handling, and does NOT wrap play()/pause() — PlayerEngine's existing
 * playback logic (offline blobs, HLS, direct file fallback) is
 * completely untouched by this module. If the current track's audio is
 * cross-origin without CORS headers (same open question already noted
 * for cover-art canvas export in `share-card-button.tsx`), the browser
 * silently "taints" the graph: audio still plays normally through
 * `ctx.destination`, but `AnalyserNode` reads come back as all-zero.
 * Callers (see `useAudioAnalyser`) detect sustained all-zero output and
 * fall back to the non-reactive visual, which is the correct behavior
 * here, not a special case to code around.
 */

let audioEl: HTMLAudioElement | null = null;
let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;
let buildAttempted = false;

/** Called by PlayerEngine on mount/unmount. The element reference itself
 *  doesn't change across track switches (only its `src` does), so this
 *  only ever needs to run twice in a normal session. */
export function registerPlayerAudioElement(el: HTMLAudioElement | null) {
  audioEl = el;
}

/**
 * Lazily builds (once) and returns the shared AnalyserNode, or `null` if
 * the Web Audio API isn't available, the audio element hasn't mounted
 * yet, or building the graph failed for any reason. Never throws.
 */
export function getSharedAnalyser(): AnalyserNode | null {
  if (analyser) return analyser;
  if (buildAttempted) return null; // already tried and permanently failed
  if (!audioEl) return null; // PlayerEngine hasn't mounted its <audio> yet — try again next frame

  const AudioCtxCtor: typeof AudioContext | undefined =
    typeof window !== "undefined"
      ? window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : undefined;
  if (!AudioCtxCtor) {
    buildAttempted = true;
    return null;
  }

  buildAttempted = true;
  try {
    ctx = new AudioCtxCtor();
    sourceNode = ctx.createMediaElementSource(audioEl);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    // Route through the analyser but keep the sound audible — connecting
    // a MediaElementAudioSourceNode into the Web Audio graph silences the
    // element's default output, so the graph must reconnect to
    // ctx.destination itself or playback would go silent.
    sourceNode.connect(analyser);
    analyser.connect(ctx.destination);
    return analyser;
  } catch {
    // A media element that (somehow) already has a source attached, an
    // environment without full Web Audio support, etc. — leave analyser
    // null and let every caller fall back to the non-reactive visual.
    analyser = null;
    return null;
  }
}

/** True once graph construction has been attempted and permanently
 *  failed (no Web Audio support, or the one-time build threw) — callers
 *  use this to stop polling forever instead of retrying every frame. */
export function isAnalyserPermanentlyUnavailable(): boolean {
  return buildAttempted && analyser === null;
}

// ---- 5-band equalizer (Phase 12) ----
// Peaking filters chained between the source and the shared analyser.
// Built lazily on the first setEqBandGain call; gains default to 0 dB,
// which is acoustically transparent, so simply building the chain never
// changes the sound until the user actually moves a slider.

const EQ_BANDS_HZ = [60, 230, 910, 3600, 14000];
let eqNodes: BiquadFilterNode[] | null = null;

/** Band center frequencies, low → high, for UI labeling. */
export function getEqBandFrequencies(): number[] {
  return EQ_BANDS_HZ;
}

/**
 * Inserts the 5-band chain between the media element source and the
 * shared analyser (replacing the old direct source→analyser hop), or
 * returns null if the graph isn't built/fails. Never throws.
 */
function ensureEqualizer(): BiquadFilterNode[] | null {
  if (eqNodes) return eqNodes;
  if (!ctx || !sourceNode || !analyser) return null;
  try {
    const nodes = EQ_BANDS_HZ.map((freq) => {
      const f = ctx!.createBiquadFilter();
      f.type = "peaking";
      f.frequency.value = freq;
      f.Q.value = 1.1;
      f.gain.value = 0;
      return f;
    });
    // Cut the direct hop so the signal can't bypass the EQ.
    try {
      sourceNode.disconnect(analyser);
    } catch {
      // wasn't connected directly — fine
    }
    let node: AudioNode = sourceNode;
    for (const f of nodes) {
      node.connect(f);
      node = f;
    }
    node.connect(analyser);
    eqNodes = nodes;
    return nodes;
  } catch {
    // Reconnect the direct hop so playback stays audible even if the
    // EQ chain could not be built.
    try {
      sourceNode.connect(analyser);
    } catch {
      // ignore
    }
    eqNodes = null;
    return null;
  }
}

/** Sets one band's gain in dB (-12..+12). Builds the EQ chain on first
 *  use. Safe to call before playback starts. */
export function setEqBandGain(index: number, gainDb: number) {
  const nodes = ensureEqualizer();
  const node = nodes?.[index];
  if (node) node.gain.value = gainDb;
}

/** Web Audio contexts start (or can drop back into) "suspended" under
 *  browser autoplay policies until resumed inside a user-gesture-adjacent
 *  call. Safe to call anytime; a no-op if already running. */
export function resumeSharedAudioContext() {
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => undefined);
  }
}
