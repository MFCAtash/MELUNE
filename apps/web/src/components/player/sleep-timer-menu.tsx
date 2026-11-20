"use client";

import { useEffect, useRef, useState } from "react";
import { AlarmClock } from "lucide-react";
import { usePlayerStore } from "@/store/player-store";
import { useTranslation } from "@/hooks/use-translation";

/** Sleep timer options: minutes presets, "end of track", off. */
const MINUTE_OPTIONS = [15, 30, 60] as const;

/**
 * Sleep timer popover for the persistent player. State lives in
 * `player-store` (`sleepAt` epoch / `sleepAfterTrackId`) so the audio
 * engine's heartbeat (player-engine.tsx) can fire it even if this menu
 * is unmounted. Shows remaining minutes in the button title while armed.
 */
export function SleepTimerMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sleepAt = usePlayerStore((s) => s.sleepAt);
  const sleepAfterTrackId = usePlayerStore((s) => s.sleepAfterTrackId);
  const currentTrackId = usePlayerStore((s) => s.queue[s.currentIndex]?.id);
  const setSleepTimer = usePlayerStore((s) => s.setSleepTimer);
  const { t } = useTranslation();

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

  const armed = sleepAt !== null || sleepAfterTrackId !== null;
  const remainingMin = sleepAt ? Math.max(0, Math.ceil((sleepAt - Date.now()) / 60_000)) : null;

  const item =
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm text-foreground transition-colors hover:bg-white/10";

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t("player.sleepTimer")}
        aria-haspopup="menu"
        aria-expanded={open}
        title={
          remainingMin !== null
            ? `${t("player.sleepTimer")}: ${remainingMin} min`
            : t("player.sleepTimer")
        }
        className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
          armed ? "text-primary" : "text-muted hover:text-foreground"
        }`}
      >
        <AlarmClock size={17} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute end-0 bottom-full z-30 mb-3 w-52 rounded-xl border border-white/10 bg-surfaceElevated p-1.5 shadow-glass"
        >
          {remainingMin !== null && (
            <p className="px-2.5 pb-1.5 pt-1 text-xs text-primary">
              {t("player.sleepRemaining", { minutes: String(remainingMin) })}
            </p>
          )}
          {MINUTE_OPTIONS.map((m) => (
            <button
              key={m}
              role="menuitem"
              className={item}
              onClick={() => {
                setSleepTimer({ type: "minutes", minutes: m });
                setOpen(false);
              }}
            >
              {t("player.sleepMinutes", { minutes: String(m) })}
            </button>
          ))}
          <button
            role="menuitem"
            className={item}
            onClick={() => {
              setSleepTimer({ type: "track" });
              setOpen(false);
            }}
          >
            {t("player.sleepEndOfTrack")}
          </button>
          <button
            role="menuitem"
            className={`${item} ${armed ? "text-rose" : ""}`}
            onClick={() => {
              setSleepTimer({ type: "off" });
              setOpen(false);
            }}
          >
            {t("player.sleepOff")}
          </button>
        </div>
      )}
      {/* keep currentTrackId referenced for future "armed on track" badge */}
      <span hidden data-sleep-track={sleepAfterTrackId === currentTrackId ? "current" : ""} />
    </div>
  );
}
