"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Pause, Play, RotateCcw, X } from "lucide-react";
import { usePlayerStore } from "@/store/player-store";
import { useTranslation } from "@/hooks/use-translation";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useFocusTimer } from "@/hooks/use-focus-timer";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { focusClock, formatClock, nextFocusTarget, type FocusTarget } from "@/lib/focus-timer";

/**
 * Focus Mode — a full-screen, deliberately empty player for people who
 * keep music on while working or studying: a big study timer and one
 * pause button, nothing else moving.
 *
 * What is intentionally NOT here, and must stay out:
 *  - no Sonic Canvas / visualizer, no PlasmaBackground, no cover art;
 *  - no ambient color. This component never calls `useAmbientTheme`, so
 *    it looks the same in Dynamic, Static, System and AMOLED modes — the
 *    background is the plain theme `bg-background` (true black under
 *    AMOLED). Accent is the fixed brand `primary`, not the track color.
 *  - no looping animation of any kind; the only motion is a one-shot
 *    fade on enter/exit, dropped entirely under `prefers-reduced-motion`.
 *
 * Timer: counts up (stopwatch) or down from 25/45/60 minutes, and only
 * runs while the music is playing — pause the music and the study clock
 * pauses with it. It belongs to this view: closing Focus Mode ends the
 * session.
 */
export function FocusMode({ onClose }: { onClose: () => void }) {
  const track = usePlayerStore((s) => s.queue[s.currentIndex] ?? null);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const { t } = useTranslation();
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  const [target, setTarget] = useState<FocusTarget>(null);
  const { elapsedSeconds, reset } = useFocusTimer(isPlaying);
  useWakeLock(true);

  // Move focus into the dialog on open and hand it back on close. The
  // container (not the pause button) takes focus: Space is a global
  // play/pause shortcut, and a focused button would fire it twice.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    rootRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  if (!track) return null;

  const { displaySeconds, complete } = focusClock(elapsedSeconds, target);
  const caption = complete ? t("focus.complete") : !isPlaying ? t("focus.paused") : "";

  const cycleTarget = () => {
    // A new length starts a new session — carrying old elapsed time into
    // a fresh countdown would show a confusing (or already-finished) clock.
    setTarget((current) => nextFocusTarget(current));
    reset();
  };

  const subtleButton =
    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted/70 transition-colors hover:text-foreground focus-visible:text-foreground";

  return (
    <motion.div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${t("focus.title")}: ${track.title}`}
      data-testid="focus-mode"
      tabIndex={-1}
      className="fixed inset-0 z-[55] flex flex-col items-center justify-center bg-background px-6 outline-none"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <button
        onClick={onClose}
        aria-label={t("focus.exit")}
        title={t("focus.exit")}
        className="absolute end-4 top-[max(1rem,env(safe-area-inset-top))] rounded-full p-2 text-muted/70 transition-colors hover:text-foreground focus-visible:text-foreground"
      >
        <X size={22} />
      </button>

      <div
        role="timer"
        aria-label={t("focus.title")}
        data-testid="focus-timer"
        className="text-7xl font-light tabular-nums tracking-tight text-foreground sm:text-8xl"
      >
        {formatClock(displaySeconds)}
      </div>

      {/* Fixed height so the pause button doesn't jump when a caption appears. */}
      <p aria-live="polite" className="mt-3 h-5 text-sm text-muted">
        {caption}
      </p>

      <button
        onClick={togglePlay}
        aria-label={isPlaying ? t("player.pause") : t("player.play")}
        className="mt-8 flex h-20 w-20 items-center justify-center rounded-full bg-primary text-white transition-transform active:scale-95"
      >
        {isPlaying ? <Pause size={32} fill="white" /> : <Play size={32} fill="white" />}
      </button>

      {/* Secondary, low-emphasis controls: pick session length / reset. */}
      <div className="absolute inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] flex items-center justify-center gap-2">
        <button onClick={cycleTarget} aria-label={t("focus.changeLength")} title={t("focus.changeLength")} className={subtleButton}>
          {target === null ? t("focus.stopwatch") : t("focus.minutes", { minutes: target })}
        </button>
        <button onClick={reset} aria-label={t("focus.reset")} title={t("focus.reset")} className={subtleButton}>
          <RotateCcw size={14} />
        </button>
      </div>
    </motion.div>
  );
}
