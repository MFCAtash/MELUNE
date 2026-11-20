"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, LogOut, Users, Radio, Loader2 } from "lucide-react";
import { useListeningRoom, type RoomState } from "@/hooks/use-listening-room";
import { usePlayerStore } from "@/store/player-store";
import { useTranslation } from "@/hooks/use-translation";
import { useAuthStore } from "@/store/auth-store";

/**
 * "Listen together" UI. Sits in the persistent player; the socket/hook
 * knows nothing about the player store, and this component is the only
 * bridge between remote room state and local playback — which keeps the
 * synchronisation rules easy to reason about (and easy to disable).
 */
export function RoomPanel() {
  const { locale } = useTranslation();
  const fa = locale === "fa";
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const room = useListeningRoom();

  const track = usePlayerStore((s) => s.queue[s.currentIndex] ?? null);
  const queue = usePlayerStore((s) => s.queue);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const seek = usePlayerStore((s) => s.seek);
  const setCurrentIndex = usePlayerStore((s) => s.setCurrentIndex);

  // Host → everyone: publish the transport ~once per second. Only the
  // host emits; there is no ping-pong between clients. `transport` is
  // read through a ref because the hook returns a fresh object each
  // render — depending on it would restart the interval constantly.
  const transportRef = useRef(room.transport);
  transportRef.current = room.transport;
  useEffect(() => {
    if (!room.isHost || !open) return;
    const id = setInterval(() => {
      void transportRef.current({ songId: track?.id ?? null, isPlaying, currentTime });
    }, 1000);
    return () => clearInterval(id);
  }, [room.isHost, open, track?.id, isPlaying, currentTime]);

  // Everyone else → local player: follow the host when something actually
  // changed. A 3s tolerance avoids micro-seeks on every state broadcast.
  const lastApplied = useRef<RoomState | null>(null);
  useEffect(() => {
    if (!room.state || room.isHost || lastApplied.current === room.state) return;
    lastApplied.current = room.state;
    const remote = room.state;

    if (remote.songId && remote.songId !== track?.id) {
      const index = queue.findIndex((s) => s.id === remote.songId);
      if (index >= 0) setCurrentIndex(index);
    }
    if (typeof remote.isPlaying === "boolean" && remote.isPlaying !== isPlaying) togglePlay();
    if (Math.abs(remote.currentTime - currentTime) > 3) seek(remote.currentTime);
    // The other store values are read at event time on purpose — adding
    // them to the dependency array would replay old remote states.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.state, room.isHost]);

  if (!user) return null;

  async function copyCode() {
    if (!room.state) return;
    try {
      await navigator.clipboard.writeText(room.state.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={fa ? "با هم گوش دادن" : "Listen together"}
        aria-expanded={open}
        className={room.state ? "text-primary" : "text-muted hover:text-foreground"}
        title={fa ? "با هم گوش دادن" : "Listen together"}
      >
        {room.connected ? <Radio size={17} /> : <Users size={17} />}
      </button>

      {open && (
        <div className="absolute bottom-full end-0 z-40 mb-3 w-72 rounded-2xl border border-border bg-surfaceElevated p-4 shadow-glow">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users size={16} /> {fa ? "با هم گوش دادن" : "Listen together"}
          </h3>

          {!room.state ? (
            <div className="flex flex-col gap-3">
              <button
                onClick={() => void room.create(track?.id ?? null)}
                disabled={!room.connected}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {fa ? "ساخت اتاق" : "Create a room"}
              </button>
              <div className="flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="ABC234"
                  maxLength={6}
                  className="min-w-0 flex-1 rounded-xl border border-border bg-background/60 px-3 py-2 text-sm uppercase text-foreground"
                />
                <button
                  onClick={() => void room.join(code)}
                  disabled={!room.connected || code.length !== 6}
                  className="rounded-xl border border-border px-3 text-sm disabled:opacity-50"
                >
                  {fa ? "پیوستن" : "Join"}
                </button>
              </div>
              {!room.connected && (
                <p className="flex items-center gap-1 text-xs text-muted">
                  <Loader2 size={12} className="animate-spin" />
                  {fa ? "در حال اتصال…" : "Connecting…"}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <button
                onClick={copyCode}
                className="flex items-center justify-between rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-left"
              >
                <span className="font-mono text-lg tracking-[0.3em] text-foreground">{room.state.code}</span>
                {copied ? <span className="text-xs text-primary">✓</span> : <Copy size={15} className="text-muted" />}
              </button>
              <p className="text-xs text-muted">
                {room.isHost
                  ? fa
                    ? "شما میزبان هستید — پخش را کنترل میکنید."
                    : "You are the host — you control playback."
                  : fa
                    ? "شما دنبال میکنید."
                    : "You're following along."}
              </p>
              <div className="flex flex-col gap-1.5">
                {room.state.participants.map((p) => (
                  <div key={p.socketId} className="flex items-center gap-2 text-xs text-foreground">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-melune-gradient text-[10px] font-bold text-white">
                      {p.username.slice(0, 2).toUpperCase()}
                    </span>
                    {p.username}
                    {p.userId === room.state?.hostId && <span className="text-primary">♛</span>}
                  </div>
                ))}
              </div>
              <button
                onClick={room.leave}
                className="mt-1 flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs text-muted hover:text-foreground"
              >
                <LogOut size={14} /> {fa ? "ترک اتاق" : "Leave room"}
              </button>
            </div>
          )}

          {room.error && <p className="mt-2 text-xs text-rose">{room.error}</p>}
        </div>
      )}
    </div>
  );
}
