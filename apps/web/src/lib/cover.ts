/**
 * Deterministic artwork fallback. Until real uploads exist (Storage phase)
 * most songs have no coverUrl, and one shared gradient made every tile
 * look identical. Hashing the title picks a stable on-brand pair instead.
 */
const PALETTES: ReadonlyArray<readonly [string, string]> = [
  ["#8B5CF6", "#3B82F6"], // brand: purple → blue
  ["#D946EF", "#7C3AED"], // magenta → violet
  ["#3B82F6", "#06B6D4"], // blue → cyan
  ["#FF6A3D", "#D946EF"], // ember → magenta
  ["#6366F1", "#8B5CF6"], // indigo → purple
  ["#14B8A6", "#3B82F6"], // teal → blue
  ["#F43F5E", "#FF6A3D"], // rose → ember
  ["#7C3AED", "#EC4899"], // violet → pink
  // Added in Phase 6.6 — the grid leaned on the purple/blue brand pair
  // too often at 8 entries; these widen the hash space so Home/Library/
  // Search grids read as more varied at a glance.
  ["#F59E0B", "#F43F5E"], // amber → rose
  ["#84CC16", "#14B8A6"], // lime → teal
  ["#06B6D4", "#6366F1"], // cyan → indigo
  ["#F59E0B", "#7C3AED"], // amber → violet
];

/**
 * Fixed swatches for the playlist color picker (Phase 8.2): one color from
 * each brand pair above, so a manually-picked accent always reads as
 * on-brand next to the auto-generated dots elsewhere in the sidebar/library.
 */
export const ACCENT_COLORS: readonly string[] = PALETTES.slice(0, 8).map(([from]) => from);

export function hashString(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function coverPalette(seed: string): readonly [string, string] {
  return PALETTES[hashString(seed) % PALETTES.length];
}

export function coverGradient(seed: string): string {
  const [from, to] = coverPalette(seed);
  return `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;
}

export function initialOf(title: string): string {
  return title.trim().charAt(0).toUpperCase() || "♪";
}
