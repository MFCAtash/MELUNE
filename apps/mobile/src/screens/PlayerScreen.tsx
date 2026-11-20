import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Audio, type AVPlaybackStatus } from "expo-av";
import type { Song } from "@codex-music/types";
import { apiClient, setAccessToken } from "../lib/api-client";

/**
 * INITIAL SKELETON — see apps/mobile/README.md.
 *
 * Plays exactly ONE sample song: the first result of
 * `GET /songs?limit=1`. No queue, no scrubber, no shuffle/repeat, no
 * MiniPlayer — this exists only to prove `expo-av` can stream a real
 * `song.audioUrl` from the API end to end, not as a start on the real
 * mobile player (that's `apps/web/src/store/player-store.ts`'s job to
 * port over, later, once this skeleton grows into Phase 10 proper).
 *
 * `onLoggedOut` exists only so there's a manual way to clear the
 * persisted access token while testing the boot flow in App.tsx — it
 * is not a designed "account" surface.
 */
export function PlayerScreen({ onLoggedOut }: { onLoggedOut: () => void }) {
  const [song, setSong] = useState<Song | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiClient
      .listSongs({ limit: 1 })
      .then((page) => {
        if (!cancelled) setSong(page.items[0] ?? null);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load a song.");
      });

    Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => undefined);

    return () => {
      cancelled = true;
      soundRef.current?.unloadAsync().catch(() => undefined);
    };
  }, []);

  async function togglePlayback() {
    if (!song) return;

    if (soundRef.current) {
      const status = await soundRef.current.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        await soundRef.current.playAsync();
        setIsPlaying(true);
      }
      return;
    }

    const { sound } = await Audio.Sound.createAsync(
      { uri: song.audioUrl },
      { shouldPlay: true },
      onPlaybackStatusUpdate,
    );
    soundRef.current = sound;
    setIsPlaying(true);
  }

  function onPlaybackStatusUpdate(status: AVPlaybackStatus) {
    if (status.isLoaded && status.didJustFinish) {
      setIsPlaying(false);
    }
  }

  async function handleLogout() {
    soundRef.current?.unloadAsync().catch(() => undefined);
    setAccessToken(null);
    onLoggedOut();
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#0B0B12" }}>
      <Pressable
        onPress={handleLogout}
        style={{ position: "absolute", top: 56, right: 24, padding: 8 }}
      >
        <Text style={{ color: "#999", fontSize: 13 }}>Log out</Text>
      </Pressable>

      {loadError ? (
        <Text style={{ color: "#ff6b6b" }}>{loadError}</Text>
      ) : !song ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 4 }}>{song.title}</Text>
          <Text style={{ color: "#999", marginBottom: 32 }}>{song.artist.name}</Text>

          <Pressable
            onPress={togglePlayback}
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: "#7C3AED",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 24 }}>{isPlaying ? "❚❚" : "▶"}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
