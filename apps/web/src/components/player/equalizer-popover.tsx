"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { SlidersHorizontal } from "lucide-react";
import { getEqBandFrequencies, setEqBandGain } from "@/lib/audio-analyser-bridge";
import { useTranslation } from "@/hooks/use-translation";

/** Preset curves, dB per band (60Hz, 230Hz, 910Hz, 3.6kHz, 14kHz). */
const PRESETS: { key: string; gains: number[] }[] = [
  { key: "player.eqFlat", gains: [0, 0, 0, 0, 0] },
  { key: "player.eqBassBoost", gains: [8, 5, 1, 0, 0] },
  { key: "player.eqVocal", gains: [-2, 3, 5, 3, 0] },
  { key: "player.eqNight", gains: [-4, -1, 1, 2, 4] },
  { key: "player.eqElectronic", gains: [5, 2, 0, 4, 6] },
];

const MAX_DB = 12;

/**
 * 5-band equalizer popover for the persistent player. Gains live in a
 * Web Audio BiquadFilter chain inside the shared graph (see
 * `audio-analyser-bridge.ts`) — this component is pure UI: sliders write
 * straight through `setEqBandGain`, presets stamp all five at once.
 * Local state only; a page reload resets to flat, which is the sane
 * default for a shared machine.
 */
export function EqualizerPopover() {
  const [open, setOpen] = useState(false);
  const [gains, setGains] = useState<number[]>([0, 0, 0, 0, 0]);
  const [activePreset, setActivePreset] = useState<string | null>("player.eqFlat");
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const frequencies = getEqBandFrequencies();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const apply = (next: number[]) => {
    next.forEach((g, i) => setEqBandGain(i, g));
    setGains(next);
  };

  const onSlider = (index: number, value: number) => {
    const next = gains.map((g, i) => (i === index ? value : g));
    apply(next);
    setActivePreset(null);
  };

  const anyActive = gains.some((g) => g !== 0);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t("player.equalizer")}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t("player.equalizer")}
        className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
          open || anyActive ? "text-primary" : "text-muted hover:text-foreground"
        }`}
      >
        <SlidersHorizontal size={17} />
      </button>

      {open && (
        <div
          role="menu"
          className="glass-panel absolute end-0 bottom-full z-30 mb-3 w-64 p-3"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            {t("player.equalizer")}
          </p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => {
                  apply(p.gains);
                  setActivePreset(p.key);
                }}
                className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                  activePreset === p.key
                    ? "bg-primary text-white"
                    : "bg-white/10 text-foreground hover:bg-white/20"
                }`}
              >
                {t(p.key as Parameters<typeof t>[0])}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {frequencies.map((hz, i) => (
              <div key={hz} className="flex items-center gap-2">
                <span className="w-14 shrink-0 text-[11px] tabular-nums text-muted">
                  {hz >= 1000 ? `${hz / 1000}k` : hz}
                </span>
                <input
                  type="range"
                  min={-MAX_DB}
                  max={MAX_DB}
                  step={1}
                  value={gains[i]}
                  onChange={(e) => onSlider(i, Number(e.target.value))}
                  aria-label={`${t("player.equalizer")} ${hz}Hz`}
                  className="volume-range flex-1"
                  style={
                    {
                      "--volume-progress": `${Math.round(((gains[i] + MAX_DB) / (MAX_DB * 2)) * 100)}%`,
                    } as CSSProperties
                  }
                />
                <span className="w-9 shrink-0 text-end text-[11px] tabular-nums text-foreground">
                  {gains[i] > 0 ? "+" : ""}
                  {gains[i]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
