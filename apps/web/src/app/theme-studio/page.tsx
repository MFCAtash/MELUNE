"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Check, Download, Link2, Palette, RotateCcw, Upload } from "lucide-react";
import { useThemeStore, type CustomThemePalette } from "@/store/theme-store";
import { decodePalette, encodePalette, isCustomThemePalette } from "@/lib/custom-theme";
import { useTranslation } from "@/hooks/use-translation";

const DEFAULT_PALETTE: CustomThemePalette = {
  background: "#06120F",
  surface: "#0C2420",
  foreground: "#ECFFF7",
  brandA: "#3DDC97",
  brandB: "#38BDF8",
};

const FIELDS: Array<{ key: keyof CustomThemePalette; label: "themeStudioBackground" | "themeStudioSurface" | "themeStudioForeground" | "themeStudioBrandA" | "themeStudioBrandB" }> = [
  { key: "background", label: "themeStudioBackground" },
  { key: "surface", label: "themeStudioSurface" },
  { key: "foreground", label: "themeStudioForeground" },
  { key: "brandA", label: "themeStudioBrandA" },
  { key: "brandB", label: "themeStudioBrandB" },
];

export default function ThemeStudioPage() {
  const { t } = useTranslation();
  const stored = useThemeStore((s) => s.customTheme);
  const setCustomTheme = useThemeStore((s) => s.setCustomTheme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const [palette, setPalette] = useState<CustomThemePalette>(stored ?? DEFAULT_PALETTE);
  const [importText, setImportText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  // Share links carry the palette in `?p=`; reading location directly (in
  // an effect) avoids useSearchParams' Suspense requirement for this page.
  useEffect(() => {
    const encoded = new URLSearchParams(window.location.search).get("p");
    if (encoded) {
      const shared = decodePalette(encoded);
      if (shared) setPalette(shared);
    }
  }, []);

  function update(key: keyof CustomThemePalette, value: string) {
    setPalette((current) => ({ ...current, [key]: value }));
    setNotice(null);
  }

  function apply() {
    setCustomTheme(palette);
    setNotice(t("common.themeStudioApplied"));
  }

  function reset() {
    setTheme("dark");
    setNotice(null);
  }

  async function share() {
    const url = `${window.location.origin}/theme-studio?p=${encodePalette(palette)}`;
    try {
      await navigator.clipboard.writeText(url);
      setNotice(url);
    } catch {
      setNotice(url);
    }
  }

  function download() {
    const blob = new Blob([JSON.stringify(palette, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "melune-theme.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importPalette() {
    const text = importText.trim();
    const encoded = text.match(/[?&]p=([^&\s]+)/)?.[1];
    const parsed: unknown = encoded ? decodePalette(encoded) : (() => {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    })();
    if (isCustomThemePalette(parsed)) {
      setPalette(parsed);
      setNotice(t("common.themeStudioApplied"));
    } else {
      setNotice(t("common.themeStudioImportHint"));
    }
  }

  const previewStyle = {
    "--preview-bg": palette.background,
    "--preview-surface": palette.surface,
    "--preview-fg": palette.foreground,
    "--preview-a": palette.brandA,
    "--preview-b": palette.brandB,
  } as CSSProperties;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 py-10">
      <header className="flex items-center gap-3">
        <Palette className="text-primary" size={28} />
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("common.themeStudio")}</h1>
          <p className="mt-1 text-sm text-muted">{t("common.themeStudioIntro")}</p>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="glass-panel flex flex-col gap-5 rounded-3xl p-6">
          {FIELDS.map(({ key, label }) => (
            <label key={key} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted">{t(`common.${label}`)}</span>
              <span className="flex items-center gap-3">
                <code className="text-xs text-muted">{palette[key]}</code>
                <input
                  type="color"
                  value={palette[key]}
                  onChange={(e) => update(key, e.target.value)}
                  aria-label={t(`common.${label}`)}
                  className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-transparent"
                />
              </span>
            </label>
          ))}

          <div className="flex flex-wrap gap-3 pt-2">
            <button onClick={apply} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white">
              <Check size={16} /> {t("common.themeStudioApply")}
            </button>
            <button onClick={reset} className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm text-foreground">
              <RotateCcw size={16} /> {t("common.themeStudioReset")}
            </button>
            <button onClick={share} className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm text-foreground">
              <Link2 size={16} /> {t("common.themeStudioShare")}
            </button>
            <button onClick={download} className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm text-foreground">
              <Download size={16} /> {t("common.themeStudioExport")}
            </button>
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-5">
            <label className="text-xs text-muted">{t("common.themeStudioImportHint")}</label>
            <div className="flex gap-2">
              <input
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-border bg-background/60 px-3 py-2 text-sm text-foreground"
              />
              <button onClick={importPalette} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 text-sm">
                <Upload size={15} /> {t("common.themeStudioImport")}
              </button>
            </div>
          </div>

          {notice && <p className="break-all text-xs text-primary">{notice}</p>}
        </section>

        <section className="flex flex-col gap-4">
          <p className="text-sm text-muted">{t("common.themeStudioPreview")}</p>
          <div style={previewStyle} className="studio-preview overflow-hidden rounded-3xl border border-white/10 p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl text-base font-bold text-white" style={{ background: `linear-gradient(135deg, var(--preview-a), var(--preview-b))` }}>M</div>
              <div>
                <div className="font-display text-lg font-bold" style={{ color: "var(--preview-fg)" }}>MELUNE</div>
                <div className="text-xs" style={{ color: "var(--preview-fg)", opacity: 0.6 }}>Now playing</div>
              </div>
            </div>
            <div className="mt-6 flex items-center gap-4 rounded-2xl p-4" style={{ background: "var(--preview-surface)" }}>
              <div className="h-16 w-16 shrink-0 rounded-xl" style={{ background: `linear-gradient(135deg, var(--preview-a), var(--preview-b))` }} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium" style={{ color: "var(--preview-fg)" }}>Your Music. Smarter.</div>
                <div className="mt-2 flex h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,.15)" }}>
                  <div className="w-2/5" style={{ background: "var(--preview-a)" }} />
                </div>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <span className="h-1.5 flex-1 rounded-full" style={{ background: "var(--preview-a)" }} />
              <span className="h-1.5 flex-1 rounded-full" style={{ background: "var(--preview-b)" }} />
              <span className="h-1.5 flex-1 rounded-full opacity-40" style={{ background: "var(--preview-fg)" }} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
