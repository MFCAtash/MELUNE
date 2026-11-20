import type { TranslationKey } from "@/lib/i18n/translate";

export type NavId = "home" | "search" | "library";

export interface NavItem {
  id: NavId;
  labelKey: TranslationKey;
  href: string;
  /** Not built yet — rendered as a visibly disabled item, never a dead link. */
  soon?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "home", labelKey: "nav.home", href: "/home" },
  { id: "search", labelKey: "nav.search", href: "/search" },
  { id: "library", labelKey: "nav.library", href: "/library" },
];

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Routes rendered inside the AppShell (the `(app)` route group). The
 *  persistent player uses this to float above the mobile bottom nav. */
const SHELL_PREFIXES = [
  "/home",
  "/library",
  "/playlist",
  "/album",
  "/artist",
  "/song",
  "/genre",
  "/search",
];

export function isShellRoute(pathname: string): boolean {
  return SHELL_PREFIXES.some((p) => isActive(pathname, p));
}

/** Only allow same-site relative redirects after login (`?next=`). */
export function safeRedirect(next: string | null | undefined, fallback = "/home"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return fallback;
  }
  return next;
}
