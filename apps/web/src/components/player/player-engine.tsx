"use client";

import { useEffect, useRef } from "react";
import Hls from "hls.js";
import { usePlayerStore } from "@/store/player-store";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { getOfflineObjectUrl } from "@/lib/offline-store";
import { registerPlayerAudioElement, resumeSharedAudioContext } from "@/lib/audio-analyser-bridge";

export function PlayerEngine() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // One play recorded per track load, not per play/pause toggle.
  const recordedTrackId = useRef<string | null>(null);
  // Object URL created from an offline blob, if the current track was
  // loaded from the IndexedDB cache — must be revoked when we move on,
  // or the underlying blob leaks for the tab's lifetime.
  const offlineObjectUrl = useRef<string | null>(null);
  // HLS/adaptive-bitrate streaming (see docs/architecture.md). Only ever
  // attached for the live remote stream — an offline download is always
  // the plain `audioUrl` file already sitting on disk, so there's
  // nothing for hls.js to adapt there.
  const hls = useRef<Hls | null>(null);

  const track = usePlayerStore((s) => s.queue[s.currentIndex] ?? null);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const seekVersion = usePlayerStore((s) => s.seekVersion);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime);
  const setDuration = usePlayerStore((s) => s.setDuration);
  const onTrackEnded = usePlayerStore((s) => s.onTrackEnded);
  const pause = usePlayerStore((s) => s.pause);

  // Load a new source whenever the track changes. Prefers a downloaded
  // copy from IndexedDB (works fully offline, and skips the network
  // even when online); otherwise prefers the HLS adaptive-bitrate
  // playlist when the track has one, falling back to the direct
  // audioUrl file — unchanged from before this feature — for tracks
  // that haven't been transcoded (or never will be) and for any HLS
  // playback error.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    let cancelled = false;

    const revokePrevious = () => {
      if (offlineObjectUrl.current) {
        URL.revokeObjectURL(offlineObjectUrl.current);
        offlineObjectUrl.current = null;
      }
    };

    const teardownHls = () => {
      if (hls.current) {
        hls.current.destroy();
        hls.current = null;
      }
    };

    const playSrc = (src: string) => {
      audio.src = src;
      audio.currentTime = 0;
      if (isPlaying) {
        // If the shared Web Audio graph exists (full-screen player opened
        // once), the element's output flows through it — a context left
        // suspended by autoplay policy would keep playback silent while
        // the progress bar keeps moving. Resuming here runs inside the
        // same user gesture that triggered playback, so it always lifts.
        resumeSharedAudioContext();
        audio.play().catch(() => pause());
      }
    };

    (async () => {
      const cachedUrl = await getOfflineObjectUrl(track.id);
      if (cancelled) {
        if (cachedUrl) URL.revokeObjectURL(cachedUrl);
        return;
      }
      revokePrevious();
      teardownHls();
      offlineObjectUrl.current = cachedUrl;

      if (cachedUrl) {
        playSrc(cachedUrl);
      } else if (track.hlsPlaylistUrl && Hls.isSupported()) {
        const instance = new Hls();
        hls.current = instance;
        instance.on(Hls.Events.ERROR, (_event, data) => {
          // Any fatal HLS error (bad/partial transcode, network blip on
          // the playlist itself, ...) degrades to the direct file so a
          // broken HLS rendition never blocks playback outright.
          if (data.fatal) {
            teardownHls();
            playSrc(track.audioUrl);
          }
        });
        instance.loadSource(track.hlsPlaylistUrl);
        instance.attachMedia(audio);
        audio.currentTime = 0;
        if (isPlaying) {
          resumeSharedAudioContext();
          audio.play().catch(() => pause());
        }
      } else if (
        track.hlsPlaylistUrl &&
        audio.canPlayType("application/vnd.apple.mpegurl")
      ) {
        // Safari/iOS play HLS natively — hls.js isn't needed (and isn't
        // supported) there.
        playSrc(track.hlsPlaylistUrl);
      } else {
        playSrc(track.audioUrl);
      }
    })();

    // Records once per track load, only when the listener is signed in —
    // anonymous plays aren't attributable to a user's history yet.
    if (recordedTrackId.current !== track.id && useAuthStore.getState().user) {
      recordedTrackId.current = track.id;
      apiClient.recordPlay(track.id).catch(() => undefined);
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id]);

  // Revoke the last offline object URL and tear down hls.js on unmount.
  useEffect(() => {
    return () => {
      if (offlineObjectUrl.current) URL.revokeObjectURL(offlineObjectUrl.current);
      if (hls.current) hls.current.destroy();
    };
  }, []);

  // Phase 10 (Sonic Canvas) — registers this <audio> element with the
  // shared analyser bridge so a real, audio-reactive visual can be built
  // elsewhere without this component knowing or caring about that. Pure
  // registration only: nothing here touches src/play/pause/volume, so
  // every existing playback path above is unaffected.
  useEffect(() => {
    registerPlayerAudioElement(audioRef.current);
    return () => registerPlayerAudioElement(null);
  }, []);

  // Play/pause side effect.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    if (isPlaying) {
      // Same autoplay-policy guard as playSrc() — a suspended Web Audio
      // context would route the element's (already-wired) output to
      // silence even though the media itself is "playing".
      resumeSharedAudioContext();
      audio.play().catch(() => pause());
    } else {
      audio.pause();
    }
  }, [isPlaying, track, pause]);

  // Volume/mute.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = muted;
  }, [volume, muted]);

  // Explicit seeks only (see seekVersion doc in the store).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = currentTime;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekVersion]);

  // Sleep timer heartbeat: once a minute (or "end of track") timer has
  // elapsed, pause playback and clear it. 1s interval is deliberately
  // coarse — the timer is a courtesy, not a stopwatch.
  useEffect(() => {
    const iv = setInterval(() => {
      const { sleepAt, fireSleepTimer } = usePlayerStore.getState();
      if (sleepAt !== null && Date.now() >= sleepAt) fireSleepTimer();
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  return (
    <audio
      ref={audioRef}
      onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
      onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
      onEnded={onTrackEnded}
      preload="metadata"
    />
  );
}
