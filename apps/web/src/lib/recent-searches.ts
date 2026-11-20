const STORAGE_KEY = "melune:recent-searches";
const MAX_ENTRIES = 8;

/**
 * Guest-only "recent searches", read before the user types anything into
 * the palette or the /search page. Signed-in users get the server-backed
 * version instead (SearchHistory table, via useSearchHistory) so it
 * follows them across devices — this is purely the local fallback.
 */
export function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** Moves `query` to the front, de-duplicated, capped at MAX_ENTRIES. */
export function addRecentSearch(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed || typeof window === "undefined") return getRecentSearches();

  const next = [trimmed, ...getRecentSearches().filter((q) => q.toLowerCase() !== trimmed.toLowerCase())].slice(
    0,
    MAX_ENTRIES,
  );

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full/unavailable (private browsing) — recent searches just won't persist.
  }
  return next;
}

export function clearRecentSearches(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore — nothing to clean up if it never wrote in the first place.
  }
}
