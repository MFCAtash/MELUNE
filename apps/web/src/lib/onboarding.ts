/**
 * Post-signup genre onboarding (Phase 6.7).
 *
 * There's no `/users/me/preferences` endpoint on the API yet — Home's
 * "Made for you" is built entirely from listening history (see
 * DiscoverService.getHome, which returns `madeForYou: null` until the
 * user has actually played something). That's the right call
 * long-term, but it means a brand-new account sees an empty mix for a
 * while. Storing the onboarding picks client-side and using them only
 * as a *fallback* — never overwriting real history-based results —
 * closes that gap without touching the backend contract.
 */
const KEY = "codex-onboarding-genres";

export function getOnboardingGenreIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export function setOnboardingGenreIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(ids));
}

/** Has the picker been shown (picked some genres, or explicitly skipped)? */
export function hasSeenOnboarding(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(KEY) !== null;
}

/** Skipping still marks onboarding as seen, with no genres — so we don't re-prompt. */
export function skipOnboarding(): void {
  setOnboardingGenreIds([]);
}
