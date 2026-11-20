"use client";

import { useAmbientColor } from "./use-ambient-color";
import { useMediaQuery } from "./use-media-query";
import { useAmbientThemeStore, type AmbientMode } from "@/store/ambient-theme-store";
import { resolveAmbientColor } from "@/lib/ambient-color-utils";

export interface AmbientTheme {
  /** Contrast-safety-clamped color, ready to hand to PlasmaBackground,
   *  SonicCanvas, the seek bar, or any `--ambient-color` consumer. */
  color: string;
  /** The user's selected mode — exposed so UI (e.g. the toggle button
   *  itself) doesn't need a second store subscription. */
  mode: AmbientMode;
}

/**
 * Phase 10.1 — Ambient Theme Engine.
 *
 * Pipeline: artwork → `useAmbientColor` extraction → mode gate (static
 * and amoled both pin the brand color; system additionally pins it when
 * the OS requests `prefers-contrast: more`) → contrast-safety clamp → returned
 * for use on the limited set of surfaces this project already applies
 * ambient color to (player backdrop, seek bar, app-wide ambient wash,
 * Sonic Canvas) — never body text, never anywhere WCAG AA contrast
 * would break.
 *
 * Drop-in replacement for the raw `useAmbientColor(coverUrl, seed)`
 * calls in `full-screen-player.tsx` and `app-shell.tsx`: same
 * arguments, and by default ("dynamic" is the store's initial mode)
 * produces the same per-track tinting behavior those already had,
 * just clamped.
 */
export function useAmbientTheme(coverUrl: string | null | undefined, seed: string): AmbientTheme {
  const rawColor = useAmbientColor(coverUrl, seed);
  const mode = useAmbientThemeStore((s) => s.mode);
  const prefersHighContrast = useMediaQuery("(prefers-contrast: more)");

  // Mode gate + clamp live in `resolveAmbientColor` (lib/ambient-color-utils)
  // so the queue color strip applies the identical rules per track. The
  // brand color is returned verbatim there, not clamped: it's the same
  // fixed #8B5CF6 already used unclamped on primary buttons/badges
  // everywhere else (see tailwind.config.ts — "Brand colors stay fixed
  // across themes on purpose"), so it's known-safe by construction. The
  // clamp exists for values nothing guarantees are safe: real per-track
  // extraction from arbitrary cover art.
  return { color: resolveAmbientColor(rawColor, mode, prefersHighContrast), mode };
}
