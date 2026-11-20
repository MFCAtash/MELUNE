"use client";

import { useCallback, useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "@/store/auth-store";

const WS_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:4000");

export interface RoomParticipant {
  userId: string;
  username: string;
  socketId: string;
}

export interface RoomState {
  code: string;
  hostId: string;
  songId: string | null;
  isPlaying: boolean;
  currentTime: number;
  participants: RoomParticipant[];
  createdAt: number;
}

interface Ack<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

type TransportUpdate = Partial<Pick<RoomState, "songId" | "isPlaying" | "currentTime">>;

/**
 * Client for the API's `/rooms` Socket.io namespace (RoomsGateway).
 *
 * The socket is only opened for a signed-in user, reads the token fresh on
 * every reconnect (same silent-refresh rationale as the notifications
 * socket), and exposes a tiny imperative API. Applying a remote state to
 * the actual player is deliberately left to the RoomPanel component: the
 * hook never mutates the player store behind React's back.
 */
export function useListeningRoom() {
  const uid = useAuthStore((s) => s.user?.id ?? null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [state, setState] = useState<RoomState | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    const s: Socket = io(`${WS_BASE_URL}/rooms`, {
      auth: (callback) => callback({ token: useAuthStore.getState().accessToken }),
    });
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onState = (next: RoomState) => setState(next);
    const onError = (payload: { message?: string }) => setError(payload.message ?? "Room error");
    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("room:state", onState);
    s.on("room:error", onError);
    setSocket(s);

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("room:state", onState);
      s.off("room:error", onError);
      s.disconnect();
      setSocket(null);
      setState(null);
    };
  }, [uid]);

  const run = useCallback(
    (event: string, payload: unknown): Promise<RoomState | null> =>
      new Promise((resolve) => {
        if (!socket?.connected) {
          setError("Not connected — sign in and try again");
          resolve(null);
          return;
        }
        socket.emit(event, payload, (ack: Ack<RoomState>) => {
          if (ack?.ok && ack.data) {
            setState(ack.data);
            setError(null);
            resolve(ack.data);
          } else {
            setError(ack?.error ?? "Room error");
            resolve(null);
          }
        });
      }),
    [socket],
  );

  const create = useCallback((songId: string | null) => run("room:create", { songId }), [run]);
  const join = useCallback((code: string) => run("room:join", { code }), [run]);
  const transport = useCallback((update: TransportUpdate) => run("room:transport", update), [run]);
  const leave = useCallback(() => {
    socket?.emit("room:leave");
    setState(null);
  }, [socket]);

  return {
    connected,
    state,
    error,
    isHost: Boolean(uid && state?.hostId === uid),
    create,
    join,
    transport,
    leave,
    clearError: () => setError(null),
  };
}
