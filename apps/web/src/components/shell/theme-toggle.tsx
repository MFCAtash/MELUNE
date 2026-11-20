"use client";

import { useEffect, useRef, useState } from "react";
import { Palette } from "lucide-react";
import { useThemeStore, type Theme } from "@/store/theme-store";
import { useTranslation } from "@/hooks/use-translation";

/** Translation keys used for theme labels — kept as a literal union so
 *  `t()` stays type-checked (same as everywhere else in the app). */
type ThemeLabelKey =
  | "common.themeDark"
  | "common.themeLight"
  | "common.themeRoyal"
  | "common.themeAurora"
  | "common.themeNoirRose"
  | "common.themeEmerald"
  | "common.themeSunset"
  | "common.themeCyber"
  | "common.themeChampagne"
  | "common.themeIce"
  | "common.themeMocha"
  | "common.themeViolet"
  | "common.themeNowruz"
  | "common.themeYalda"
  | "common.themeChristmas"
  | "common.themeAuroraNoir"
  | "common.themeNeonTokyo"
  | "common.themeGoldenHour"
  | "common.themeEmeraldVelvet"
  | "common.themeRoseQuartz"
  | "common.themeCyberLime";

/** Signature themes lead the menu: they repaint shell *and* brand
 *  gradient/halo, so the swatches show the full two-tone identity. */
const SIGNATURE_THEMES: { id: Theme; labelKey: ThemeLabelKey; swatch: string }[] = [
  { id: "aurora-noir", labelKey: "common.themeAuroraNoir", swatch: "linear-gradient(135deg, #070B1A 0%, #7C5CFF 55%, #22D3EE 100%)" },
  { id: "neon-tokyo", labelKey: "common.themeNeonTokyo", swatch: "linear-gradient(135deg, #05060A 0%, #FF2E97 55%, #00E5FF 100%)" },
  { id: "golden-hour", labelKey: "common.themeGoldenHour", swatch: "linear-gradient(135deg, #120C08 0%, #F5A524 60%, #FF7A45 100%)" },
  { id: "emerald-velvet", labelKey: "common.themeEmeraldVelvet", swatch: "linear-gradient(135deg, #04120E 0%, #10B981 55%, #D4AF37 100%)" },
  { id: "rose-quartz", labelKey: "common.themeRoseQuartz", swatch: "linear-gradient(135deg, #160A12 0%, #FF6FA5 55%, #C084FC 100%)" },
  { id: "cyber-lime", labelKey: "common.themeCyberLime", swatch: "linear-gradient(135deg, #060806 0%, #C6F432 55%, #22C55E 100%)" },
];

/** Classic shell themes — surface hue only, original brand pair. */
const CLASSIC_THEMES: { id: Theme; labelKey: ThemeLabelKey; swatch: string }[] = [
  { id: "dark", labelKey: "common.themeDark", swatch: "linear-gradient(135deg, #0A0A0F 0%, #2A2A3C 100%)" },
  { id: "light", labelKey: "common.themeLight", swatch: "linear-gradient(135deg, #F8F8FB 0%, #D9D9E8 100%)" },
  { id: "royal", labelKey: "common.themeRoyal", swatch: "linear-gradient(135deg, #080A16 0%, #3A2E7D 100%)" },
  { id: "aurora", labelKey: "common.themeAurora", swatch: "linear-gradient(135deg, #050C10 0%, #0F766E 100%)" },
  { id: "noir-rose", labelKey: "common.themeNoirRose", swatch: "linear-gradient(135deg, #0D080D 0%, #9F1239 100%)" },
  { id: "emerald", labelKey: "common.themeEmerald", swatch: "linear-gradient(135deg, #070C0A 0%, #047857 100%)" },
  { id: "sunset", labelKey: "common.themeSunset", swatch: "linear-gradient(135deg, #100908 0%, #EA580C 100%)" },
  { id: "cyber", labelKey: "common.themeCyber", swatch: "linear-gradient(135deg, #04040A 0%, #7C3AED 60%, #22D3EE 100%)" },
  { id: "champagne", labelKey: "common.themeChampagne", swatch: "linear-gradient(135deg, #0B0A07 0%, #B45309 100%)" },
  { id: "ice", labelKey: "common.themeIce", swatch: "linear-gradient(135deg, #060A10 0%, #0284C7 100%)" },
  { id: "mocha", labelKey: "common.themeMocha", swatch: "linear-gradient(135deg, #0D0A08 0%, #92400E 100%)" },
  { id: "violet", labelKey: "common.themeViolet", swatch: "linear-gradient(135deg, #0A0610 0%, #A21CAF 100%)" },
  { id: "nowruz", labelKey: "common.themeNowruz", swatch: "linear-gradient(135deg, #080E0A 0%, #E11D48 50%, #F59E0B 100%)" },
  { id: "yalda", labelKey: "common.themeYalda", swatch: "linear-gradient(135deg, #0C0507 0%, #BE123C 100%)" },
  { id: "christmas", labelKey: "common.themeChristmas", swatch: "linear-gradient(135deg, #060C09 0%, #166534 60%, #DC2626 100%)" },
];

const THEMES = [...SIGNATURE_THEMES, ...CLASSIC_THEMES];

/** One row in the theme menu — swatch, label, and the active check. */
function ThemeOption({
  id,
  labelKey,
  swatch,
  active,
  onPick,
}: {
  id: Theme;
  labelKey: ThemeLabelKey;
  swatch: string;
  active: boolean;
  onPick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      key={id}
      role="menuitemradio"
      aria-checked={active}
      onClick={onPick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start text-sm ${
        active ? "text-primary" : "text-foreground hover:bg-surface"
      }`}
    >
      <span
        aria-hidden
        className="h-5 w-5 shrink-0 rounded-full border border-white/20"
        style={{ background: swatch }}
      />
      <span className="flex-1 truncate">{t(labelKey)}</span>
      {active && <span className="text-xs">✓</span>}
    </button>
  );
}

/**
 * Theme picker. Started as the Phase 6.7 light/dark toggle (single icon
 * button) and grew into a dropdown when the premium shell themes landed
 * — there are now six themes, too many to cycle with one button.
 * Mirrors UserMenu's dropdown mechanics (outside-click + Escape close,
 * `aria-haspopup`/`aria-expanded`), and keeps the same hydration guard:
 * `persist` only rehydrates one tick after mount, so the label waits
 * for `mounted` before trusting `theme` — same pattern next-themes uses.
 */
export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const { t } = useTranslation();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = THEMES.find((x) => x.id === theme) ?? THEMES[0];
  const label = mounted ? `${t("common.theme")}: ${t(current.labelKey)}` : t("common.theme");

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className={`flex h-9 w-9 items-center justify-center rounded-full bg-surface transition-colors hover:text-primary ${
          open ? "text-primary" : "text-muted"
        }`}
      >
        <Palette size={16} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute end-0 top-full z-30 mt-2 max-h-[24rem] w-60 overflow-y-auto rounded-xl border border-border bg-surfaceElevated p-1.5 shadow-glow"
        >
          <p className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted">
            {t("common.theme")}
          </p>
          {SIGNATURE_THEMES.map((x) => (
            <ThemeOption
              key={x.id}
              id={x.id}
              labelKey={x.labelKey}
              swatch={x.swatch}
              active={mounted && x.id === theme}
              onPick={() => {
                setTheme(x.id);
                setOpen(false);
              }}
            />
          ))}
          <p className="mt-1 border-t border-border px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-muted/70">
            {t("common.themeClassic")}
          </p>
          {CLASSIC_THEMES.map((x) => (
            <ThemeOption
              key={x.id}
              id={x.id}
              labelKey={x.labelKey}
              swatch={x.swatch}
              active={mounted && x.id === theme}
              onPick={() => {
                setTheme(x.id);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
