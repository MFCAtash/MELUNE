/**
 * Shared per-track color pipeline (step 1 of "queue colour preview").
 *
 * `use-ambient-color.ts` used to own both the deterministic fallback and
 * the canvas-based dominant-color extraction, but only as a hook — fine
 * for the one track that is playing, unusable for "give me the colors of
 * the next eight tracks" (hooks can't run in a loop). The logic lives
 * here now as plain functions, plus a small memoizing loader, so:
 *
 *  - `useAmbientColor` (the playing track) and `useQueueColors` (the queue
 *    strip) go through the exact same extraction and therefore agree on
 *    the color of any given track;
 *  - a cover is decoded at most once per session — the queue strip
 *    pre-warms the cache for upcoming tracks, so when one becomes the
 *    current track its ambient color is already there.
 *
 * Nothing here is new data: it is the same real-artwork average (or the
 * same title+artist hash when there is no artwork / the image is
 * CORS-tainted) the app already computes for the current track.
 */

/** Deterministic HSL derived from a string — same input always gives the
 *  same color, so a song without artwork still gets a stable, distinct
 *  ambient tone instead of one flat gray for every track. */
export function hashToHsl(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 55%)`;
}

/** The seed every ambient-color call site already uses for a song. */
export function trackColorSeed(song: { title: string; artist: { name: string } }): string {
  return `${song.title}-${song.artist.name}`;
}

export function extractDominantColor(imageUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const size = 32; // downsample — we only need an average, not detail
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        let r = 0,
          g = 0,
          b = 0,
          count = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);
        resolve(`rgb(${r}, ${g}, ${b})`);
      } catch {
        // Canvas throws on cross-origin images without proper CORS
        // headers (getImageData taints) — fall back rather than crash.
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
}

const CACHE_LIMIT = 200;
const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

export function trackColorKey(coverUrl: string | null | undefined, seed: string): string {
  return `${coverUrl ?? ""}|${seed}`;
}

/** Synchronous cache lookup — `undefined` until `loadTrackColor` resolved once. */
export function getCachedTrackColor(coverUrl: string | null | undefined, seed: string): string | undefined {
  return cache.get(trackColorKey(coverUrl, seed));
}

function remember(key: string, color: string) {
  if (cache.size >= CACHE_LIMIT) {
    // Map iterates in insertion order → the first key is the oldest.
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, color);
}

/**
 * Resolves to the track's raw ambient color: real extraction from
 * `coverUrl` when readable, otherwise the deterministic `seed` hash.
 * Never rejects. A failed extraction is cached as the fallback too, so an
 * unreadable cover is not re-fetched every time the queue re-renders.
 */
export function loadTrackColor(coverUrl: string | null | undefined, seed: string): Promise<string> {
  const key = trackColorKey(coverUrl, seed);
  const cached = cache.get(key);
  if (cached !== undefined) return Promise.resolve(cached);

  if (!coverUrl) {
    const fallback = hashToHsl(seed);
    remember(key, fallback);
    return Promise.resolve(fallback);
  }

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = extractDominantColor(coverUrl)
    .then((extracted) => extracted ?? hashToHsl(seed))
    .catch(() => hashToHsl(seed))
    .then((color) => {
      remember(key, color);
      inflight.delete(key);
      return color;
    });
  inflight.set(key, promise);
  return promise;
}

/** Test seam — the cache is module state. */
export function clearTrackColorCache() {
  cache.clear();
  inflight.clear();
}
