/**
 * Phase 10.1 — Ambient Theme Engine, step 2: contrast-safety clamping.
 *
 * `useAmbientColor` returns either `rgb(r, g, b)` (real extraction from
 * artwork) or `hsl(h, 70%, 55%)` (deterministic fallback — see that
 * hook). Either can land anywhere in the color space: a mostly-white
 * cover averages to near-white, a mostly-black one to near-black, both
 * of which read as "broken" rather than "ambient" once used as a glow
 * behind text or a seek-bar fill. This clamps saturation/lightness into
 * a band that always reads as a deliberate accent — never a wash of
 * near-white/near-black, and never so gray it stops feeling like "the
 * artwork's color."
 *
 * Reuses `lib/color.ts`'s existing `parseColor`/`hslToRgb` (already
 * built for `seek-bar.tsx`'s gradient, and already tolerant of hex/rgb/
 * hsl + alpha) rather than growing a second color parser — the two
 * modules were briefly duplicated during this phase's first pass; this
 * is the corrected, single-parser version.
 *
 * This does not replace `useAmbientColor` (kept as-is for anything that
 * genuinely wants the raw extracted value) — it's applied by
 * `useAmbientTheme`, which is what player/app-shell surfaces should use
 * going forward.
 */

import { parseColor, hslToRgb } from "./color";
import type { AmbientMode } from "@/store/ambient-theme-store";

/** Safe band: readable as an accent against both the dark and light
 *  theme surfaces (see globals.css's --color-background tokens) without
 *  ever being mistaken for plain white/black or turning fully gray. */
const SAFE_SATURATION_MIN = 42;
const SAFE_SATURATION_MAX = 90;
const SAFE_LIGHTNESS_MIN = 32;
const SAFE_LIGHTNESS_MAX = 62;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Parses `raw` (whatever `useAmbientColor` returned, or a static brand
 * hex) and returns a contrast-safety-clamped color string in the same
 * shape it was given (hsl stays hsl, rgb/rgba stays rgb/rgba, hex is
 * returned as hsl since hex can't carry a lightness clamp back out
 * losslessly any more simply than that). If `raw` can't be parsed at
 * all, returns it unchanged — fails open, the same philosophy already
 * documented for Redis cache misses in this project, rather than ever
 * throwing or blanking out the ambient color entirely.
 */
export function toSafeAmbientColor(raw: string): string {
  const parsed = parseColor(raw);
  if (!parsed) return raw;

  const h = ((parsed.h % 360) + 360) % 360;
  const s = clamp(parsed.s, SAFE_SATURATION_MIN, SAFE_SATURATION_MAX);
  const l = clamp(parsed.l, SAFE_LIGHTNESS_MIN, SAFE_LIGHTNESS_MAX);

  if (parsed.alpha !== undefined) {
    const [r, g, b] = hslToRgb(h, s, l);
    return `rgba(${r}, ${g}, ${b}, ${parsed.alpha})`;
  }
  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}

/** The one constant brand color (see tailwind.config.ts's `primary`
 *  token) used whenever ambient tinting is off. Duplicated as a literal
 *  rather than imported from Tailwind's config (which isn't consumable
 *  as a plain value at runtime here) — same approach already taken for
 *  the focus-ring color in globals.css. */
export const BRAND_STATIC_COLOR = "#8B5CF6";

/**
 * The mode gate + safety clamp of the Ambient Theme Engine as a pure
 * function, so single-track callers (`useAmbientTheme`) and multi-track
 * callers (`useQueueColors`, which can't call a hook per queue entry)
 * apply exactly the same rules:
 *
 * - static / amoled always pin the brand color, and so does system when
 *   the OS asks for `prefers-contrast: more`;
 * - the brand color is returned verbatim (it is known-safe by
 *   construction — see tailwind.config.ts), everything else goes
 *   through `toSafeAmbientColor`.
 */
export function resolveAmbientColor(
  rawColor: string,
  mode: AmbientMode,
  prefersHighContrast: boolean,
): string {
  const shouldPinStatic =
    mode === "static" || mode === "amoled" || (mode === "system" && prefersHighContrast);
  if (shouldPinStatic) return BRAND_STATIC_COLOR;
  return toSafeAmbientColor(rawColor);
}
