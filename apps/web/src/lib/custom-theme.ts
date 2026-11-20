import type { CustomThemePalette } from "@/store/theme-store";

/** Converts `#rrggbb` into the space-separated RGB triplets the CSS
 *  design tokens use (`--color-background: 10 10 15`). */
export function hexToRgbTriplet(hex: string): string {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  const n = Number.parseInt(full, 16);
  if (!Number.isFinite(n) || full.length !== 6) return "10 10 15";
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

function mix(a: string, b: string, weight: number): string {
  const parse = (hex: string) => {
    const v = hex.replace("#", "");
    const full = v.length === 3 ? v.split("").map((c) => c + c).join("") : v;
    const n = Number.parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const ch = (x: number, y: number) =>
    Math.round(x * (1 - weight) + y * weight).toString(16).padStart(2, "0");
  return `#${ch(ar, br)}${ch(ag, bg)}${ch(ab, bb)}`;
}

/** Derives the dependent tokens from the five user-editable colors, so a
 *  custom palette stays internally consistent (readable text, visible
 *  borders, a halo that matches the brand) instead of producing a theme
 *  that looks right in the picker and wrong in the app. */
export function applyCustomTheme(palette: CustomThemePalette): void {
  if (typeof document === "undefined") return;
  const s = document.documentElement.style;
  const elevated = mix(palette.surface, palette.foreground, 0.06);
  const muted = mix(palette.foreground, palette.surface, 0.45);
  const border = mix(palette.surface, palette.foreground, 0.14);

  const vars: Record<string, string> = {
    "--color-background": hexToRgbTriplet(palette.background),
    "--color-surface": hexToRgbTriplet(palette.surface),
    "--color-surface-elevated": hexToRgbTriplet(elevated),
    "--color-foreground": hexToRgbTriplet(palette.foreground),
    "--color-muted": hexToRgbTriplet(muted),
    "--color-border-rgb": hexToRgbTriplet(border),
    "--color-primary": hexToRgbTriplet(palette.brandA),
    "--color-accent": hexToRgbTriplet(palette.brandB),
    "--brand-a": hexToRgbTriplet(palette.brandA),
    "--brand-b": hexToRgbTriplet(palette.brandB),
    "--halo-1": hexToRgbTriplet(palette.brandA),
    "--halo-2": hexToRgbTriplet(palette.brandB),
  };
  for (const [key, value] of Object.entries(vars)) s.setProperty(key, value);
}

export function clearCustomTheme(): void {
  if (typeof document === "undefined") return;
  const s = document.documentElement.style;
  for (const key of [
    "--color-background",
    "--color-surface",
    "--color-surface-elevated",
    "--color-foreground",
    "--color-muted",
    "--color-border-rgb",
    "--color-primary",
    "--color-accent",
    "--brand-a",
    "--brand-b",
    "--halo-1",
    "--halo-2",
  ]) {
    s.removeProperty(key);
  }
}

const isHex = (value: unknown): value is string => typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);

export function isCustomThemePalette(value: unknown): value is CustomThemePalette {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    isHex(v.background) && isHex(v.surface) && isHex(v.foreground) && isHex(v.brandA) && isHex(v.brandB)
  );
}

/** URL-safe base64 of the palette, used by share links. */
export function encodePalette(palette: CustomThemePalette): string {
  const json = JSON.stringify(palette);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodePalette(encoded: string): CustomThemePalette | null {
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return isCustomThemePalette(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
