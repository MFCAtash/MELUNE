import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme =
  | "dark"
  | "light"
  | "royal"
  | "aurora"
  | "noir-rose"
  | "emerald"
  | "sunset"
  | "cyber"
  | "champagne"
  | "ice"
  | "mocha"
  | "violet"
  | "nowruz"
  | "yalda"
  | "christmas"
  // Signature themes — full identity (shell + brand gradient + halo)
  | "aurora-noir"
  | "neon-tokyo"
  | "golden-hour"
  | "emerald-velvet"
  | "rose-quartz"
  | "cyber-lime";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

/**
 * Persisted light/dark preference (Phase 6.7). Defaults to dark — that's
 * the theme the whole design system was built against. The no-flash
 * inline script in the root layout reads the same "melune-theme"
 * localStorage key before hydration to set `<html data-theme>`
 * synchronously, the same trick used for locale — see layout.tsx and
 * globals.css for the CSS variables each value switches.
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      setTheme: (theme) => {
        set({ theme });
        if (typeof document !== "undefined") {
          document.documentElement.dataset.theme = theme;
        }
      },
      toggleTheme: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
    }),
    { name: "melune-theme" },
  ),
);
