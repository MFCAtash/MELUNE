"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  ChevronDown,
  Focus,
  ListMusic,
  Pause,
  Play,
  Repeat,
  Repeat1,
  RotateCcw,
  RotateCw,
  Share2,
  Shuffle,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { usePlayerStore } from "@/store/player-store";
import { useUiStore } from "@/store/ui-store";
import { useTranslation } from "@/hooks/use-translation";
import { useAmbientTheme } from "@/hooks/use-ambient-theme";
import { useMediaQuery } from "@/hooks/use-media-query";
import { seekBy } from "@/lib/player-utils";
import { mockLyricsProvider, type LyricLine } from "@/lib/contracts/lyrics";
import { SeekBar } from "./seek-bar";
import { VinylCover } from "./vinyl-cover";
import { SonicCanvas } from "./sonic-canvas";
import { SonicClipButton } from "./sonic-clip-button";
import { QueueColorStrip } from "./queue-color-strip";
import { ShareCardButton } from "./share-card-button";
import { PlasmaBackground } from "./plasma-background";
import { LikeButton } from "@/components/library/like-button";
import { AddToPlaylistButton } from "@/components/library/add-to-playlist-button";
import { Cover } from "@/components/ui/cover";
import { formatDuration } from "@/lib/format";

/** ±10s button: a circular arrow with the "10" printed inside it. */
function SkipSeconds({
  direction,
  label,
  onClick,
}: {
  direction: "back" | "forward";
  label: string;
  onClick: () => void;
}) {
  const Icon = direction === "back" ? RotateCcw : RotateCw;
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="relative flex h-11 w-11 items-center justify-center text-foreground/90 transition-colors hover:text-foreground"
    >
      <Icon size={28} strokeWidth={1.5} />
      <span aria-hidden className="absolute text-[9px] font-bold leading-none">
        10
      </span>
    </button>
  );
}

export function FullScreenPlayer({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"now-playing" | "lyrics">("now-playing");
  const [lyrics, setLyrics] = useState<LyricLine[] | null>(null);

  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const track = usePlayerStore((s) => s.queue[s.currentIndex] ?? null);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const next = usePlayerStore((s) => s.next);
  const previous = usePlayerStore((s) => s.previous);
  const seek = usePlayerStore((s) => s.seek);
  const playQueue = usePlayerStore((s) => s.playQueue);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const queueOpen = useUiStore((s) => s.queueOpen);
  const toggleQueue = useUiStore((s) => s.toggleQueue);
  const openFocusMode = useUiStore((s) => s.openFocusMode);
  const { t } = useTranslation();
  // Respects the same `prefers-reduced-motion` contract SonicCanvas and
  // PlasmaBackground already follow: no slide/fade or shared-element
  // morph, just an instant show/hide. Uses the project's own
  // `useMediaQuery` hook (Phase 10.1), not framer-motion's built-in
  // `useReducedMotion` — that calls `window.matchMedia` unconditionally,
  // which is undefined in this project's jsdom test setup (see
  // `use-media-query.ts`'s own guard comment).
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const lyricRefs = useRef<Array<HTMLParagraphElement | null>>([]);
  // The ambient (mode="aurora") Sonic Canvas below is the one worth
  // capturing as a clip — full-bleed, coherent with the rest of the
  // backdrop — unlike the small "compact" bars indicator further down.
  const sonicCanvasRef = useRef<HTMLCanvasElement>(null);

  // Phase 10.1 — Ambient Theme Engine: same extraction as before, now
  // gated by the user's Static/Dynamic/System choice and always
  // contrast-safety-clamped before reaching the backdrop/seek-bar/Sonic
  // Canvas below.
  const { color: ambientColor } = useAmbientTheme(
    track?.coverUrl,
    track ? `${track.title}-${track.artist.name}` : "codex",
  );

  useEffect(() => {
    if (!track) return;
    let cancelled = false;
    mockLyricsProvider.getLyrics(track.id).then((lines) => {
      if (!cancelled) setLyrics(lines);
    });
    return () => {
      cancelled = true;
    };
  }, [track?.id]);

  const activeLyricIndex = lyrics
    ? lyrics.reduce((best, line, i) => (line.timeSeconds <= currentTime ? i : best), -1)
    : -1;

  // Phase 10.2 — Player Polish: smooth auto-scroll to the active lyric line
  // instead of leaving the reader to scroll manually. `mockLyricsProvider`
  // is still a placeholder (see lib/contracts/lyrics.ts) — only the
  // rendering improves here, so swapping in a real synced-lyrics source
  // later is a drop-in. Must run before the `!track` early return below
  // (same as every other hook in this component) — the rules of hooks
  // don't bend for a placeholder feature.
  useEffect(() => {
    if (activeLyricIndex < 0) return;
    lyricRefs.current[activeLyricIndex]?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "center",
    });
  }, [activeLyricIndex, reduceMotion]);

  if (!track) return null;

  const RepeatIcon = repeat === "one" ? Repeat1 : Repeat;
  const upNext = queue
    .slice(currentIndex + 1, currentIndex + 4)
    .map((song, i) => ({ song, index: currentIndex + 1 + i }));

  // The queue panel floats underneath this overlay, so minimise first.
  const openQueue = () => {
    onClose();
    if (!queueOpen) toggleQueue();
  };

  const modeButton = (on: boolean) => `transition-colors ${on ? "text-primary" : "text-muted hover:text-foreground"}`;

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={t("player.nowPlaying")}
      className="fixed inset-0 z-50 overflow-y-auto bg-background"
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: 24 }}
      transition={{ type: "spring", stiffness: 300, damping: 32 }}
    >
      {/* Backdrop: blurred artwork + ambient glow (real canvas colour when the
          song has artwork, a stable per-song hue otherwise — see use-ambient-color). */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        {track.coverUrl && (
          <Image
            src={track.coverUrl}
            alt=""
            fill
            priority
            sizes="100vw"
            className="scale-125 object-cover opacity-40 blur-3xl"
          />
        )}
        <div
          className="absolute inset-0 opacity-40 transition-colors duration-1000"
          style={{ background: `radial-gradient(circle at 50% 18%, ${ambientColor}, transparent 62%)` }}
        />
        <PlasmaBackground color={ambientColor} />
        {/* Sonic Canvas (Phase 10) — audio-reactive counterpart to the
            static PlasmaBackground above: real frequency data from the
            currently playing track, not a preset animation. Falls back
            to a calm static frame automatically (see SonicCanvas/
            useAudioAnalyser) if reduced-motion is set, playback is
            paused, or no usable analyser data is available. */}
        <SonicCanvas
          ref={sonicCanvasRef}
          isPlaying={isPlaying}
          mode="aurora"
          variant="ambient"
          color={ambientColor}
          className="absolute inset-0 h-full w-full opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/70 to-background" />
      </div>

      <div className="relative mx-auto flex min-h-full w-full max-w-md flex-col px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        {/* Top bar */}
        <div className="flex items-center justify-between py-2">
          <button
            onClick={onClose}
            aria-label={t("player.minimize")}
            className="glass-panel flex h-10 w-10 items-center justify-center !rounded-full text-foreground"
          >
            <ChevronDown size={22} />
          </button>
          <div className="flex gap-6 text-sm">
            <button
              onClick={() => setTab("now-playing")}
              aria-pressed={tab === "now-playing"}
              className={tab === "now-playing" ? "text-primary" : "text-muted"}
            >
              {t("player.nowPlaying")}
            </button>
            <button
              onClick={() => setTab("lyrics")}
              aria-pressed={tab === "lyrics"}
              className={tab === "lyrics" ? "text-primary" : "text-muted"}
            >
              {t("player.lyrics")}
            </button>
          </div>
          <span className="w-10" aria-hidden />
        </div>

        {/* Artwork / lyrics */}
        <div className="mt-4 flex flex-col items-center">
          {tab === "now-playing" ? (
            <>
              {/* Phones: rounded-square artwork. Larger screens keep the vinyl.
                  Same `np-cover-${track.id}` layoutId as the mini-player's
                  artwork tile (persistent-player.tsx) — this is the other
                  end of the shared-element handoff, not a standalone
                  animation. Reduced-motion users still get the isPlaying
                  scale cue via the motion-safe: classes below; they just
                  skip the cross-component morph (layout={false}). */}
              <motion.div
                layoutId={`np-cover-${track.id}`}
                layout={!reduceMotion}
                className={`aspect-square w-full max-w-xs overflow-hidden rounded-3xl shadow-glow-lg ring-1 ring-white/10 motion-safe:transition-transform motion-safe:duration-500 sm:hidden ${
                  isPlaying ? "scale-100" : "scale-95"
                }`}
              >
                <Cover title={track.title} url={track.coverUrl} className="h-full w-full text-7xl" />
              </motion.div>
              <div className="hidden sm:block">
                <VinylCover title={track.title} coverUrl={track.coverUrl} isPlaying={isPlaying} />
              </div>

              <div className="glass-panel mt-6 flex w-full items-center gap-3 !rounded-2xl px-4 py-3">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-bold text-foreground">{track.title}</h2>
                  <p className="truncate text-sm text-muted">{track.artist.name}</p>
                </div>
                <SonicCanvas
                  isPlaying={isPlaying}
                  mode="bars"
                  variant="compact"
                  color={ambientColor}
                  className="h-4 w-14 shrink-0"
                />
                <LikeButton songId={track.id} size={22} />
              </div>
            </>
          ) : (
            <div className="glass-panel flex h-[26rem] w-full flex-col gap-5 overflow-y-auto !rounded-3xl p-6 text-center">
              {(lyrics ?? []).map((line, i) => (
                <p
                  key={i}
                  ref={(el) => {
                    lyricRefs.current[i] = el;
                  }}
                  className={`leading-snug transition-all duration-300 ${
                    i === activeLyricIndex
                      ? "scale-105 text-xl font-semibold text-foreground"
                      : "text-lg text-muted"
                  }`}
                >
                  {line.text}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="glass-panel mt-5 flex flex-col gap-4 !rounded-3xl p-4">
          <SeekBar
            currentTime={currentTime}
            duration={duration}
            onSeek={seek}
            showRemaining
            ambientColor={ambientColor}
          />

          <div className="flex items-center justify-between">
            <button onClick={previous} className="p-2 text-foreground" aria-label={t("player.previous")}>
              <SkipBack size={24} fill="white" />
            </button>
            <SkipSeconds
              direction="back"
              label={t("player.back10")}
              onClick={() => seek(seekBy(currentTime, -10, duration))}
            />
            <button
              onClick={togglePlay}
              className={`flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-[0_0_28px_var(--ambient-color)] ${
                isPlaying ? "animate-play-pulse" : ""
              }`}
              style={{ "--ambient-color": ambientColor } as CSSProperties}
              aria-label={isPlaying ? t("player.pause") : t("player.play")}
            >
              {isPlaying ? <Pause size={26} fill="white" /> : <Play size={26} fill="white" />}
            </button>
            <SkipSeconds
              direction="forward"
              label={t("player.forward10")}
              onClick={() => seek(seekBy(currentTime, 10, duration))}
            />
            <button onClick={next} className="p-2 text-foreground" aria-label={t("player.next")}>
              <SkipForward size={24} fill="white" />
            </button>
          </div>

          <div className="flex items-center justify-between px-2 pt-1">
            <button
              onClick={toggleShuffle}
              className={modeButton(shuffle)}
              aria-label={shuffle ? t("player.shuffleOn") : t("player.shuffleOff")}
              aria-pressed={shuffle}
            >
              <Shuffle size={20} />
            </button>
            <button
              onClick={cycleRepeat}
              className={modeButton(repeat !== "off")}
              aria-label={
                repeat === "off" ? t("player.repeatOff") : repeat === "all" ? t("player.repeatAll") : t("player.repeatOne")
              }
              aria-pressed={repeat !== "off"}
            >
              <RepeatIcon size={20} />
            </button>
            <span className="text-muted">
              <AddToPlaylistButton songId={track.id} />
            </span>
            <button
              onClick={() => navigator.clipboard?.writeText(window.location.href)}
              title={t("player.copyLink")}
              aria-label={t("player.copyLink")}
              className="text-muted transition-colors hover:text-foreground"
            >
              <Share2 size={20} />
            </button>
            <span className="text-muted">
              <ShareCardButton title={track.title} artist={track.artist.name} />
            </span>
            <span className="text-muted">
              <SonicClipButton canvasRef={sonicCanvasRef} title={track.title} isPlaying={isPlaying} />
            </span>
            <button
              onClick={openFocusMode}
              aria-label={t("focus.title")}
              title={t("focus.title")}
              className="text-muted transition-colors hover:text-foreground"
            >
              <Focus size={20} />
            </button>
            <button
              onClick={openQueue}
              aria-label={t("player.queue")}
              title={t("player.queue")}
              className="text-muted transition-colors hover:text-foreground"
            >
              <ListMusic size={20} />
            </button>
          </div>
        </div>

        {/* Up next */}
        {upNext.length > 0 && (
          <section aria-labelledby="fs-up-next" className="mt-6">
            <h3 id="fs-up-next" className="mb-3 text-sm font-semibold text-foreground">
              {t("queue.upNext")}
            </h3>
            <QueueColorStrip size="md" className="mb-3" />
            <ul className="flex flex-col gap-2">
              {upNext.map(({ song, index }) => (
                <li key={`${song.id}-${index}`}>
                  <button
                    onClick={() => playQueue(queue, index)}
                    title={t("queue.playFromHere")}
                    className="flex w-full items-center gap-3 rounded-2xl bg-white/[0.05] p-2 text-start ring-1 ring-white/5 transition-colors hover:bg-white/10"
                  >
                    <span className="h-11 w-11 shrink-0 overflow-hidden rounded-xl">
                      <Cover title={song.title} url={song.coverUrl} className="h-full w-full text-base" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{song.title}</span>
                      <span className="block truncate text-xs text-muted">{song.artist.name}</span>
                    </span>
                    <span className="pe-2 text-xs tabular-nums text-muted">{formatDuration(song.duration)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </motion.div>
  );
}
