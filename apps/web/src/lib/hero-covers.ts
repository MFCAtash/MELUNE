/**
 * Curated artwork for the Home hero ("Trending right now").
 *
 * Unlike `coverGradient` (a deterministic fallback for songs without
 * artwork), these are real, hand-picked covers supplied for the landing
 * moment at the top of Home. They are intentionally *not* tied to the
 * current trending list: the hero is a mood board for the catalog, so it
 * keeps the same five sleeves while the queue behind it changes.
 *
 * Files live in `public/hero-covers/` — replace a file in place to swap
 * the artwork without touching code. Order matters: index 2 is the
 * centre card of the desktop fan.
 */
export interface HeroCover {
  /** Public path, e.g. "/hero-covers/bi-ehsas.jpg". */
  src: string;
  /** Accessible name (the fan itself is decorative, but useful for alt text). */
  title: string;
  artist: string;
}

export const HERO_COVERS: HeroCover[] = [
  { src: "/hero-covers/googoosh.jpg", title: "Googoosh", artist: "Googoosh" },
  { src: "/hero-covers/ebi.jpg", title: "Jane Javani", artist: "Ebi" },
  { src: "/hero-covers/bi-ehsas.jpg", title: "Bi Ehsas", artist: "Shadmehr Aghili" },
  { src: "/hero-covers/hayedeh.jpg", title: "Hayedeh", artist: "Hayedeh" },
  { src: "/hero-covers/tarafdar.jpg", title: "Tarafdaar", artist: "Shadmehr Aghili" },
];
