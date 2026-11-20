"use client";

import { forwardRef, useEffect, useRef } from "react";
import { useAudioAnalyser, type AudioLevels } from "@/hooks/use-audio-analyser";

export type SonicCanvasMode = "bars" | "wave" | "aurora" | "particles" | "minimal";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

interface ParticleState {
  particles: Particle[];
  prevBass: number;
}

interface SonicCanvasProps {
  isPlaying: boolean;
  mode?: SonicCanvasMode;
  /** Any valid CSS color string — normally the track's ambient color. */
  color?: string;
  className?: string;
  /** "compact" = drop-in replacement for the old 4-bar CSS indicator
   *  (small, inline, same footprint). "ambient" = a larger, lower-opacity
   *  backdrop layer. Only affects default bar/particle counts — sizing
   *  itself is controlled by `className`. */
  variant?: "compact" | "ambient";
}

/**
 * Phase 10 — Sonic Canvas: a real, audio-reactive generative visual,
 * replacing the previous CSS-only `AudioVisualizer` (which only ever
 * knew `isPlaying`, never the actual sound). Reads live frequency data
 * from `useAudioAnalyser` and renders it via Canvas 2D — no WebGL
 * dependency, since none of these modes need it.
 *
 * Gracefully degrades to a calm static frame — matching the old
 * visualizer's idle look — when: `prefers-reduced-motion` is set,
 * playback is paused, or `useAudioAnalyser` reports non-reactive (Web
 * Audio unsupported, CORS-tainted source, or a still-suspended
 * AudioContext — see that hook's doc comment for why these share one
 * fallback path).
 *
 * Forwards its `<canvas>` node via `ref` — added for `SonicClipButton`
 * (Phase 10 stretch goal: `canvas.captureStream()` clip export), which
 * needs the actual DOM node this component is already drawing to rather
 * than a second canvas. Purely additive: nothing about the draw loop
 * below reads or depends on the forwarded ref, only the local
 * `canvasRef` used internally does.
 */
export const SonicCanvas = forwardRef<HTMLCanvasElement, SonicCanvasProps>(function SonicCanvas(
  { isPlaying, mode = "bars", color = "#8b5cf6", className = "", variant = "compact" },
  forwardedRef,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particleStateRef = useRef<ParticleState>({ particles: [], prevBass: 0 });
  const { levelsRef, reactive } = useAudioAnalyser(isPlaying);

  const prefersReducedMotionRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    prefersReducedMotionRef.current = mq.matches;
    const onChange = () => {
      prefersReducedMotionRef.current = mq.matches;
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // Measured, not sniffed: if recent frames are consistently slow, drop
  // to a cheaper render path (fewer bars/particles) for this device.
  const lowPowerRef = useRef(false);
  const frameTimesRef = useRef<number[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    // No 2D canvas support in this environment (or jsdom in tests) —
    // nothing to draw, and nothing to poll for. Bail before touching
    // ResizeObserver/rAF at all.
    if (!ctx2d) return;

    let raf = 0;
    const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
    };
    resize();

    const RO = typeof window !== "undefined" ? window.ResizeObserver : undefined;
    const ro = RO ? new RO(resize) : undefined;
    ro?.observe(canvas);

    const drawStatic = () => {
      const { width, height } = canvas;
      ctx2d.clearRect(0, 0, width, height);
      ctx2d.fillStyle = color;
      if (mode === "minimal") {
        ctx2d.globalAlpha = 0.35;
        ctx2d.beginPath();
        ctx2d.arc(width / 2, height / 2, Math.min(width, height) / 6, 0, Math.PI * 2);
        ctx2d.fill();
      } else {
        // Calm flat baseline — mirrors the old CSS bars' 20%-height idle state.
        ctx2d.globalAlpha = 0.35;
        const bars = variant === "compact" ? 4 : 24;
        const gap = width / bars;
        for (let i = 0; i < bars; i++) {
          const h = height * 0.2;
          ctx2d.fillRect(i * gap + gap * 0.25, height - h, gap * 0.5, h);
        }
      }
      ctx2d.globalAlpha = 1;
    };

    if (prefersReducedMotionRef.current || !isPlaying || !reactive) {
      drawStatic();
      return () => ro?.disconnect();
    }

    let lastTime = performance.now();

    const frame = (now: number) => {
      const dt = now - lastTime;
      lastTime = now;
      frameTimesRef.current.push(dt);
      if (frameTimesRef.current.length >= 30) {
        const avgDt = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
        lowPowerRef.current = avgDt > 34; // sustained under ~30fps
        frameTimesRef.current.length = 0;
      }

      const { width, height } = canvas;
      const levels = levelsRef.current;
      ctx2d.clearRect(0, 0, width, height);

      switch (mode) {
        case "bars":
          drawBars(ctx2d, width, height, levels, color, variant === "compact" ? 4 : lowPowerRef.current ? 16 : 32);
          break;
        case "wave":
          drawWave(ctx2d, width, height, levels, color, now);
          break;
        case "aurora":
          drawAurora(ctx2d, width, height, levels, color, now);
          break;
        case "particles":
          drawParticles(ctx2d, width, height, levels, color, particleStateRef.current, lowPowerRef.current);
          break;
        case "minimal":
          drawMinimal(ctx2d, width, height, levels, color);
          break;
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, reactive, mode, color, variant]);

  return (
    <canvas
      ref={(node) => {
        canvasRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }}
      aria-hidden="true"
      className={className}
    />
  );
});

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawBars(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  levels: AudioLevels,
  color: string,
  barCount: number,
) {
  const gap = width / barCount;
  const now = performance.now();
  for (let i = 0; i < barCount; i++) {
    // Map bar position across the spectrum: low index = bass, high = treble.
    const t = i / barCount;
    const level = t < 0.33 ? levels.bass : t < 0.66 ? levels.mid : levels.treble;
    const jitter = 0.8 + Math.sin(i * 1.7 + now / 220) * 0.2;
    const h = Math.max(height * 0.08, Math.min(height, height * level * jitter));
    const w = gap * 0.5;
    const x = i * gap + gap * 0.25;
    const y = height - h;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.55 + level * 0.45;
    roundRectPath(ctx, x, y, w, h, Math.min(w / 2, 4));
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawWave(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  levels: AudioLevels,
  color: string,
  now: number,
) {
  const midY = height / 2;
  const amplitude = height * 0.35 * (0.25 + levels.overall * 0.75);
  ctx.lineWidth = Math.max(1.5, height * 0.06);
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  const steps = 64;
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * width;
    const phase = now / 260 + i * 0.35;
    const y =
      midY +
      Math.sin(phase) * amplitude * 0.6 +
      Math.sin(phase * 1.9 + levels.treble * 4) * amplitude * 0.4;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawAurora(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  levels: AudioLevels,
  color: string,
  now: number,
) {
  // Two soft, slowly-drifting radial blobs whose size/opacity pulse with
  // bass/mid — the audio-reactive counterpart to the static
  // `PlasmaBackground`, built with radial gradients (not ctx.filter blur,
  // which isn't reliably supported everywhere) for the soft-edge look.
  const blobs = [
    { cx: 0.3, cy: 0.4, speed: 1, level: levels.bass },
    { cx: 0.7, cy: 0.6, speed: 1.3, level: levels.mid },
  ];
  for (const blob of blobs) {
    const drift = 0.06;
    const x = width * (blob.cx + Math.sin(now / 4000 + blob.speed) * drift);
    const y = height * (blob.cy + Math.cos(now / 5000 + blob.speed) * drift);
    const baseRadius = Math.min(width, height) * (0.35 + blob.level * 0.25);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, baseRadius);
    gradient.addColorStop(0, colorWithAlpha(color, 0.35 + blob.level * 0.25));
    gradient.addColorStop(1, colorWithAlpha(color, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  levels: AudioLevels,
  color: string,
  state: ParticleState,
  lowPower: boolean,
) {
  // Onset detection: spawn a small burst only when bass rises sharply
  // (a "hit"), not on every frame — otherwise this just becomes noise.
  const rising = levels.bass - state.prevBass > 0.12 && levels.bass > 0.35;
  state.prevBass = levels.bass;

  if (rising) {
    const burst = lowPower ? 2 : 5;
    for (let i = 0; i < burst; i++) {
      state.particles.push({
        x: width / 2 + (Math.random() - 0.5) * width * 0.4,
        y: height * 0.85,
        vx: (Math.random() - 0.5) * 0.6,
        vy: -0.6 - Math.random() * 0.8,
        life: 0,
        maxLife: 45 + Math.random() * 30,
        size: 2 + Math.random() * 3 + levels.bass * 3,
      });
    }
  }

  const cap = lowPower ? 60 : 160;
  if (state.particles.length > cap) state.particles.splice(0, state.particles.length - cap);

  ctx.fillStyle = color;
  for (const p of state.particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.life += 1;
    const t = p.life / p.maxLife;
    ctx.globalAlpha = Math.max(0, 1 - t) * 0.7;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (1 - t * 0.4), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  state.particles = state.particles.filter((p) => p.life < p.maxLife);
}

function drawMinimal(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  levels: AudioLevels,
  color: string,
) {
  const cx = width / 2;
  const cy = height / 2;
  const base = Math.min(width, height) / 6;
  const radius = base * (0.85 + levels.overall * 0.6);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.3 + levels.overall * 0.4;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** Best-effort alpha compositing for whatever color string the caller
 *  passes (hex, rgb()/rgba(), hsl()) by wrapping it in a color-mix — a
 *  plain string-alpha rewrite would need per-format parsing, and every
 *  browser this project already targets (per the Firefox seek-bar note
 *  in CHANGES-phase8_2-ui-review.md) supports color-mix. */
function colorWithAlpha(color: string, alpha: number): string {
  const pct = Math.round(Math.max(0, Math.min(1, alpha)) * 100);
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}
