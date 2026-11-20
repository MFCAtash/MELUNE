"use client";

import { useEffect } from "react";
import { usePlayerStore } from "@/store/player-store";

/**
 * Media Session API — the OS-level "now playing" surface.
 *
 * With this mounted, a track shows its artwork, title and artist on the
 * Windows/macOS/Android/iOS lock screen and in the browser's media
 * hub, and the hardware media keys (play/pause, next, previous) drive
 * the in-app player instead of doing nothing. That is a genuinely
 * *visible* surface of the product: it is what someone sees when the
 * tab is not in front of them.
 *
 * Design notes:
 *  - Entirely additive. Nothing here reads or mutates playback state
 *    except by calling the store's own public actions, so every
 *    existing playback path is untouched.
 *  - Feature-detected twice (the `mediaSession` object and the
 *    `MediaMetadata` constructor), because Safari exposed the object
 *    before it exposed metadata. Unsupported environments are a
 *    silent no-op, not an error.
 *  - `setActionHandler` throws on actions a platform doesn't support,
 *    so each handler is registered defensively.
 */
export function useMediaSession(): void {
  const track = usePlayerStore((s) => s.queue[s.currentIndex] ?? null);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const duration = usePlayerStore((s) => s.duration);
  // Rounded to the second: the lock-screen scrubber doesn't need
  // sub-second precision, and this keeps the engine from re-rendering
  // on every ~250ms `timeupdate`.
  const positionSeconds = usePlayerStore((s) => Math.floor(s.currentTime));

  // Metadata + artwork for the current track.
  useEffect(() => {
    if (!supportsMediaSession() || !track) return;
    const ms = navigator.mediaSession;
    const artwork = artworkVariants(track.coverUrl);
    if (artwork.length > 0) {
      ms.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist.name,
        album: track.album?.title ?? "",
        artwork,
      });
    } else {
      ms.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist.name,
        album: track.album?.title ?? "",
      });
    }
  }, [track]);

  // Transport controls. Registered once — the handlers read the store
  // imperatively so they never go stale.
  useEffect(() => {
    if (!supportsMediaSession()) return;
    const ms = navigator.mediaSession;
    const store = () => usePlayerStore.getState();

    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ["play", () => store().togglePlay()],
      ["pause", () => store().togglePlay()],
      ["stop", () => store().pause()],
      ["previoustrack", () => store().previous()],
      ["nexttrack", () => store().next()],
      [
        "seekbackward",
        (details) => {
          const { currentTime, seek } = store();
          seek(Math.max(0, currentTime - (details.seekOffset ?? 10)));
        },
      ],
      [
        "seekforward",
        (details) => {
          const { currentTime, duration: total, seek } = store();
          seek(Math.min(total || currentTime + (details.seekOffset ?? 10), currentTime + (details.seekOffset ?? 10)));
        },
      ],
      [
        "seekto",
        (details) => {
          if (typeof details.seekTime === "number") store().seek(details.seekTime);
        },
      ],
    ];

    for (const [action, handler] of handlers) {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        // Platform doesn't support this action — that's fine, the
        // in-app controls still work.
      }
    }

    return () => {
      for (const [action] of handlers) {
        try {
          ms.setActionHandler(action, null);
        } catch {
          // Same as above.
        }
      }
    };
  }, []);

  // Play/pause reflected on the lock screen.
  useEffect(() => {
    if (!supportsMediaSession()) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

  // Scrubber position. `setPositionState` rejects out-of-range values
  // (and a NaN/Infinity duration), so clamp defensively — a broken
  // position update must never throw during playback.
  useEffect(() => {
    if (!supportsMediaSession() || typeof navigator.mediaSession.setPositionState !== "function") return;
    if (!Number.isFinite(duration) || duration <= 0) return;
    const position = Math.min(Math.max(positionSeconds, 0), duration);
    try {
      navigator.mediaSession.setPositionState({ duration, position, playbackRate: 1 });
    } catch {
      // Ignore: some browsers reject while the element is still loading.
    }
  }, [positionSeconds, duration]);
}

function supportsMediaSession(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "mediaSession" in navigator &&
    navigator.mediaSession !== null &&
    typeof MediaMetadata !== "undefined"
  );
}

/** The same image at several declared sizes — platforms pick the best
 *  one for their lock-screen widget scale. */
function artworkVariants(coverUrl: string | null): MediaImage[] {
  if (!coverUrl) return [];
  const type = coverUrl.toLowerCase().endsWith(".png")
    ? "image/png"
    : coverUrl.toLowerCase().endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";
  return [
    { src: coverUrl, sizes: "96x96", type },
    { src: coverUrl, sizes: "256x256", type },
    { src: coverUrl, sizes: "512x512", type },
  ];
}
