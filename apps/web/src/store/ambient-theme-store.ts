import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useThemeStore } from "./theme-store";

export type AmbientMode = "static" | "dynamic" | "system" | "amoled";

const ORDER: AmbientMode[] = ["dynamic", "static", "system", "amoled"];

interface AmbientThemeState {
  mode: AmbientMode;
  setMode: (mode: AmbientMode) => void;
  cycleMode: () => void;
}

/** Reflects `mode` onto `<html data-amoled>`, the hook `globals.css`'s
 *  true-black override reads (see the Ambient Theme Engine section of
 *  docs/design-system.md). Also called from the no-flash inline script
 *  in `layout.tsx` before hydration, so this stays a small, standalone
 *  function rather than something tucked inside the store action. */
function syncAmoledDom(mode: AmbientMode) {
  if (typeof document === "undefined") return;
  if (mode === "amoled") {
    document.documentElement.dataset.amoled = "true";
    // True black only makes visual/battery sense over the dark palette —
    // forcing dark here mirrors theme-store.ts's own setTheme, which
    // already writes `data-theme` as a side effect of the same store
    // action pattern.
    useThemeStore.getState().setTheme("dark");
  } else {
    delete document.documentElement.dataset.amoled;
  }
}

/**
 * Persisted ambient-color mode (Phase 10.1, extended with a 4th mode),
 * same shape and persistence pattern as `theme-store.ts`'s light/dark
 * toggle.
 *
 * - "dynamic" (default) — today's existing behavior: `useAmbientColor`'s
 *   per-track extraction, contrast-clamped, applied to the player
 *   backdrop / seek bar / app-wide ambient wash / Sonic Canvas.
 * - "static" — ambient tinting off; every one of those surfaces falls
 *   back to the fixed brand color (`primary`, #8B5CF6) instead.
 * - "system" — dynamic, except when the OS reports
 *   `prefers-contrast: more`, in which case it behaves like "static" for
 *   that session. There's no OS-level signal for "prefers a calmer
 *   music UI" the way there is for light/dark, so this is deliberately
 *   scoped to the one real accessibility signal that applies — see
 *   `use-ambient-theme.ts`.
 * - "amoled" — true-black background/surfaces for OLED screens (see
 *   globals.css's `[data-amoled="true"]` override) plus brand-color
 *   pinning, same as "static", for the color pipeline. Forces the
 *   light/dark preference to dark the moment it's selected — true black
 *   over the light palette isn't a real "AMOLED savings" mode, just a
 *   broken light theme.
 */
export const useAmbientThemeStore = create<AmbientThemeState>()(
  persist(
    (set, get) => ({
      mode: "dynamic",
      setMode: (mode) => {
        set({ mode });
        syncAmoledDom(mode);
      },
      cycleMode: () => {
        const currentIndex = ORDER.indexOf(get().mode);
        const next = ORDER[(currentIndex + 1) % ORDER.length];
        get().setMode(next);
      },
    }),
    { name: "melune-ambient-mode" },
  ),
);
