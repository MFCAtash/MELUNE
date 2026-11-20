"use client";

import { useAmbientTheme } from "@/hooks/use-ambient-theme";
import { PlasmaBackground } from "./plasma-background";

/**
 * Drops a contained, contrast-safety-clamped ambient wash (see
 * `useAmbientTheme`) behind a single page-header block — the same
 * artwork → color pipeline the player and app shell already use,
 * extended to artist/album pages per Phase 10.1's "limited, named set
 * of surfaces" rule.
 *
 * `artist/[id]/page.tsx` and `album/[id]/page.tsx` are server
 * components (they `await catalog.get…` directly) and `useAmbientTheme`
 * is a hook, so this tiny client component is the seam between them —
 * it owns no state of its own beyond the hook, and renders nothing but
 * the decorative backdrop. The caller is responsible for wrapping its
 * header in `relative isolate overflow-hidden` so `PlasmaBackground`'s
 * `absolute inset-0` (intensity="page") stays contained to that block
 * rather than bleeding into the rest of the page.
 */
export function AmbientPageBackdrop({
  coverUrl,
  seed,
}: {
  coverUrl?: string | null;
  seed: string;
}) {
  const { color } = useAmbientTheme(coverUrl, seed);
  return <PlasmaBackground color={color} intensity="page" />;
}
