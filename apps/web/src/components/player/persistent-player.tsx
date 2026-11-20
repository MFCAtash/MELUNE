"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, type CSSProperties } from "react";
// Project's own reduced-motion hook rather than framer-motion's
// `useReducedMotion` — see media-card.tsx's comment on why (jsdom has
// no `window.matchMedia`, which framer-motion's version calls
// unconditionally).
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  ListMusic,
  Focus,
} from "lucide-react";
import { usePlayerStore } from "@/store/player-store";
import { useUiStore } from "@/store/ui-store";
import { useTranslation } from "@/hooks/use-translation";
import { useAmbientTheme } from "@/hooks/use-ambient-theme";
import { useBeatPulse } from "@/hooks/use-beat-pulse";
import { useBeatPulseStyle } from "@/hooks/use-beat-pulse-style";
import { isShellRoute } from "@/lib/nav";
import { SeekBar } from "./seek-bar";
import { QueuePanel } from "./queue-panel";
import { FullScreenPlayer } from "./full-screen-player";
import { FocusMode } from "./focus-mode";
import { QueueColorStrip } from "./queue-color-strip";
import { VinylCover } from "./vinyl-cover";
import { SonicCanvas } from "./sonic-canvas";
import { SleepTimerMenu } from "./sleep-timer-menu";
import { EqualizerPopover } from "./equalizer-popover";
import { Cover } from "@/components/ui/cover";

export function PersistentPlayer() {
  const showQueue = useUiStore((s) => s.queueOpen);
  const closeQueue = useUiStore((s) => s.closeQueue);
  const toggleQueue = useUiStore((s) => s.toggleQueue);
  const showFullScreen = useUiStore((s) => s.fullScreenOpen);
  const openFullScreen = useUiStore((s) => s.openFullScreen);
  const closeFullScreen = useUiStore((s) => s.closeFullScreen);
  const showFocus = useUiStore((s) => s.focusModeOpen);
  const openFocusMode = useUiStore((s) => s.openFocusMode);
  const closeFocusMode = useUiStore((s) => s.closeFocusMode);

  const { t } = useTranslation();
  const pathname = usePathname();
  // Inside the AppShell, phones show a floating bottom nav — sit above it.
  const liftedClasses = isShellRoute(pathname)
    ? "max-md:bottom-[4.75rem] max-md:mx-3 max-md:rounded-2xl max-md:border"
    : "";

  const track = usePlayerStore((s) => s.queue[s.currentIndex] ?? null);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);

  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const next = usePlayerStore((s) => s.next);
  const previous = usePlayerStore((s) => s.previous);
  const seek = usePlayerStore((s) => s.seek);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);

  // Same per-track color the full-screen player and app shell already
  // use (see useAmbientTheme) — feeds the small SonicCanvas indicator
  // below so the mini-player reads as the same coherent system, not a
  // separate effect. Hook must run unconditionally (before the `!track`
  // early return), same as app-shell.tsx's identical call.
  const { color: ambientColor } = useAmbientTheme(
    track?.coverUrl,
    track ? `${track.title}-${track.artist.name}` : "melune-mini-player",
  );

  // Tempo-Reactive UI — same beat-onset detection driving the logo
  // (see logo.tsx). Also called unconditionally before the early
  // return below, for the same reason useAmbientTheme is.
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  // Focus Mode covers the whole screen and promises a still, visualizer-
  // free view — so everything audio-reactive down here (beat pulse and
  // the compact Sonic Canvas indicators) stands down while it is open
  // instead of burning frames behind an opaque overlay.
  const visualsActive = isPlaying && !showFocus;
  const { pulseRef, reactive: beatReactive } = useBeatPulse(visualsActive);
  const beatEnabled = Boolean(visualsActive && beatReactive && !prefersReducedMotion);
  const mobilePlayButtonRef = useRef<HTMLButtonElement>(null);
  const desktopPlayButtonRef = useRef<HTMLButtonElement>(null);
  const applyPlayButtonPulse = (el: HTMLElement, pulse: number) => {
    el.style.boxShadow = pulse > 0.02 ? `0 0 ${Math.round(pulse * 18)}px ${ambientColor}` : "";
    el.style.transform = `scale(${1 + pulse * 0.08})`;
  };
  useBeatPulseStyle(pulseRef, mobilePlayButtonRef, applyPlayButtonPulse, beatEnabled);
  useBeatPulseStyle(pulseRef, desktopPlayButtonRef, applyPlayButtonPulse, beatEnabled);

  // Focus Mode is a view of the current track; if the queue empties while
  // it's open, close it so it can't pop back open when something plays later.
  useEffect(() => {
    if (!track && showFocus) closeFocusMode();
  }, [track, showFocus, closeFocusMode]);

  if (!track) return null;

  const RepeatIcon = repeat === "one" ? Repeat1 : Repeat;

  return (
    <>
      {/* AnimatePresence lets FullScreenPlayer's own exit animation (and the
          shared `np-cover-${track.id}` layout transition below) play out
          before the component actually unmounts, instead of the hard cut
          there was before. */}
      <AnimatePresence>
        {showFullScreen && track && <FullScreenPlayer key="full-screen-player" onClose={closeFullScreen} />}
      </AnimatePresence>
      <AnimatePresence>
        {showFocus && track && <FocusMode key="focus-mode" onClose={closeFocusMode} />}
      </AnimatePresence>
      {showQueue && <QueuePanel onClose={closeQueue} />}

      <div
        className={`fixed inset-x-0 bottom-0 z-30 overflow-hidden border-t border-white/10 bg-surface/80 backdrop-blur-xl max-md:shadow-glass ${liftedClasses}`}
      >
        {/* Queue color preview — the mood of what plays next, visible
            without opening the queue. Renders nothing when nothing is
            queued after the current track. */}
        <QueueColorStrip size="sm" />

        {/* Mobile mini-player */}
        <div className="sm:hidden">
          <div className="flex items-center gap-2 px-3 py-2.5">
            <button
              onClick={openFullScreen}
              aria-label={`${t("player.nowPlaying")}: ${track.title}`}
              className="flex min-w-0 flex-1 items-center gap-3 text-start"
            >
              {/* `np-cover-${track.id}` is the shared-element handoff target:
                  FullScreenPlayer's mobile artwork tile uses the same
                  layoutId, so Framer Motion morphs this tile into that one
                  (and back) instead of a hard cut on open/close. */}
              <motion.span
                layoutId={`np-cover-${track.id}`}
                className="h-11 w-11 shrink-0 overflow-hidden rounded-xl shadow-lg ring-1 ring-white/10"
              >
                <Cover title={track.title} url={track.coverUrl} className="h-full w-full text-base" />
              </motion.span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{track.title}</span>
                <span className="block truncate text-xs text-muted">{track.artist.name}</span>
              </span>
              {/* Phase 10 — same compact Sonic Canvas indicator the
                  full-screen player's title row already uses, just
                  narrower to fit this tighter row. */}
              <SonicCanvas
                isPlaying={visualsActive}
                mode="bars"
                variant="compact"
                color={ambientColor}
                className="h-3.5 w-6 shrink-0"
              />
            </button>
            <button
              ref={mobilePlayButtonRef}
              onClick={togglePlay}
              aria-label={isPlaying ? t("player.pause") : t("player.play")}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-glow-sm"
            >
              {isPlaying ? <Pause size={16} fill="white" /> : <Play size={16} fill="white" />}
            </button>
            <button
              onClick={next}
              aria-label={t("player.next")}
              className="flex h-10 w-8 shrink-0 items-center justify-center text-foreground/80"
            >
              <SkipForward size={18} fill="currentColor" />
            </button>
          </div>
          <div aria-hidden className="h-0.5 bg-white/10">
            <div
              className="bg-melune-gradient h-full"
              style={{ width: `${duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0}%` }}
            />
          </div>
        </div>

        {/* Desktop player bar */}
        <div className="hidden grid-cols-3 items-center gap-4 px-4 py-3 sm:grid">
          <div className="flex min-w-0 items-center gap-3">
            <Link href={`/song/${track.slug}`} className="shrink-0">
              <VinylCover title={track.title} coverUrl={track.coverUrl} isPlaying={isPlaying} size="sm" />
            </Link>
            <div className="min-w-0">
              <Link href={`/song/${track.slug}`} className="block truncate text-sm font-medium text-foreground hover:underline">
                {track.title}
              </Link>
              <Link
                href={`/artist/${track.artist.slug}`}
                className="block truncate text-xs text-muted hover:text-primary"
              >
                {track.artist.name}
              </Link>
            </div>
            <SonicCanvas
              isPlaying={visualsActive}
              mode="bars"
              variant="compact"
              color={ambientColor}
              className="hidden h-4 w-8 shrink-0 md:block"
            />
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-4">
              <button
                onClick={toggleShuffle}
                className={shuffle ? "text-primary" : "text-muted hover:text-foreground"}
                aria-label={shuffle ? t("player.shuffleOn") : t("player.shuffleOff")}
                aria-pressed={shuffle}
              >
                <Shuffle size={16} />
              </button>
              <button onClick={previous} className="text-foreground" aria-label={t("player.previous")}>
                <SkipBack size={18} fill="white" />
              </button>
              <button
                ref={desktopPlayButtonRef}
                onClick={togglePlay}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-background"
                aria-label={isPlaying ? t("player.pause") : t("player.play")}
              >
                {isPlaying ? <Pause size={16} fill="black" /> : <Play size={16} fill="black" />}
              </button>
              <button onClick={next} className="text-foreground" aria-label={t("player.next")}>
                <SkipForward size={18} fill="white" />
              </button>
              <button
                onClick={cycleRepeat}
                className={repeat !== "off" ? "text-primary" : "text-muted hover:text-foreground"}
                aria-label={
                  repeat === "off" ? t("player.repeatOff") : repeat === "all" ? t("player.repeatAll") : t("player.repeatOne")
                }
                aria-pressed={repeat !== "off"}
              >
                <RepeatIcon size={16} />
              </button>
            </div>
            <div className="w-full max-w-md">
              <SeekBar currentTime={currentTime} duration={duration} onSeek={seek} compact />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <SleepTimerMenu />
            <EqualizerPopover />
            <button
              onClick={openFocusMode}
              className="text-muted hover:text-foreground"
              aria-label={t("focus.title")}
              title={t("focus.title")}
            >
              <Focus size={18} />
            </button>
            <button
              onClick={toggleQueue}
              className={showQueue ? "text-primary" : "text-muted hover:text-foreground"}
              aria-label={t("player.queue")}
              aria-pressed={showQueue}
            >
              <ListMusic size={18} />
            </button>
            <button
              onClick={toggleMute}
              className={
                muted || volume === 0
                  ? "text-rose transition-colors hover:text-rose/80" // muted: warm "off" signal
                  : "text-muted transition-colors hover:text-primary" // unmuted: brand on hover
              }
              aria-label={muted || volume === 0 ? t("player.unmute") : t("player.mute")}
            >
              {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label={t("player.volume")}
              className="volume-range w-24"
              style={{ "--volume-progress": `${Math.round((muted ? 0 : volume) * 100)}%` } as CSSProperties}
            />
          </div>
        </div>
      </div>
    </>
  );
}
