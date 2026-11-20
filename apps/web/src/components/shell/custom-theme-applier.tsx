"use client";

import { useEffect } from "react";
import { useThemeStore } from "@/store/theme-store";
import { applyCustomTheme, clearCustomTheme } from "@/lib/custom-theme";

/**
 * Mirrors the active theme into inline CSS variables. Inline styles beat
 * the `:root[data-theme=…]` blocks in globals.css, so a custom palette
 * takes effect without touching a single component. When the user picks
 * another theme the variables are removed and the built-in cascade wins.
 */
export function CustomThemeApplier() {
  const theme = useThemeStore((s) => s.theme);
  const palette = useThemeStore((s) => s.customTheme);

  useEffect(() => {
    if (theme === "custom" && palette) applyCustomTheme(palette);
    else clearCustomTheme();
    return () => clearCustomTheme();
  }, [theme, palette]);

  return null;
}
