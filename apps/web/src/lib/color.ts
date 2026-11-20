/**
 * Small color helpers for UI accents that need to react to the current
 * track's ambient color (see `useAmbientColor`). Deliberately tolerant of
 * the two formats that hook can hand back — `hsl(h, s%, l%)` for the
 * deterministic fallback, `rgb(r, g, b)` for real artwork extraction —
 * plus plain hex, since callers may also pass a static brand color.
 */

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, l * 100];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
  }
  h *= 60;

  return [h, s * 100, l * 100];
}

/** Exported alongside `parseColor` (Phase 10.1) for the same reason. */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  s /= 100;
  l /= 100;

  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hueToRgb = (t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  return [
    Math.round(hueToRgb(h / 360 + 1 / 3) * 255),
    Math.round(hueToRgb(h / 360) * 255),
    Math.round(hueToRgb(h / 360 - 1 / 3) * 255),
  ];
}

export interface ParsedColor {
  h: number;
  s: number;
  l: number;
  alpha?: number;
}

/** Exported (Phase 10.1) so other ambient-color consumers — see
 *  `ambient-color-utils.ts` — parse against this one implementation
 *  instead of growing a second hex/rgb/hsl regex parser. */
export function parseColor(color: string): ParsedColor | null {
  const hsl = color.match(/^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (hsl) {
    const [, h, s, l, a] = hsl;
    return { h: parseFloat(h), s: parseFloat(s), l: parseFloat(l), alpha: a ? parseFloat(a) : undefined };
  }

  const rgb = color.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (rgb) {
    const [, r, g, b, a] = rgb;
    const [h, s, l] = rgbToHsl(parseFloat(r), parseFloat(g), parseFloat(b));
    return { h, s, l, alpha: a ? parseFloat(a) : undefined };
  }

  const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const raw = hex[1];
    const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    const [h, s, l] = rgbToHsl(r, g, b);
    return { h, s, l };
  }

  return null;
}

/**
 * Returns a lighter version of `color`, shifting lightness by `amount`
 * percentage points (0-100 scale). Unrecognized formats (named colors,
 * `currentColor`, css variables, ...) are returned unchanged rather than
 * throwing — this only needs to be "good enough" for a decorative gradient.
 */
export function lighten(color: string, amount: number): string {
  const parsed = parseColor(color);
  if (!parsed) return color;

  const l = clamp(parsed.l + amount, 0, 100);
  if (parsed.alpha === undefined) {
    return `hsl(${Math.round(parsed.h)}, ${Math.round(parsed.s)}%, ${Math.round(l)}%)`;
  }
  const [r, g, b] = hslToRgb(parsed.h, parsed.s, l);
  return `rgba(${r}, ${g}, ${b}, ${parsed.alpha})`;
}
