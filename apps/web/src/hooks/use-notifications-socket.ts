"use client";

import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";
import { qk } from "@/lib/queries";

/**
 * Same-origin in the production stack: an empty base produces
 * `io("/notifications")`, which socket.io-client resolves against the
 * current origin. In development it points at the API on :4000.
 */
const WS_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:4000");

/**
 * Real-time half of the in-app notification inbox (see
 * NotificationsGateway on the API for the server side). Mount this once
 * near the app root (e.g. alongside <Providers>) for any signed-in user;
 * it opens one Socket.io connection to the `/notifications` namespace
 * and, on every "notification:new" event, invalidates the same React
 * Query keys useMyNotifications/useUnreadNotificationCount read from —
 * so the inbox and the unread badge update instantly instead of waiting
 * on their slow fallback `refetchInterval` (see lib/queries.ts).
 *
 * Does not replace Web Push (usePushNotifications) — that's the channel
 * for when no tab is open at all. This is purely for tabs that are
 * already open.
 */
export function useNotificationsSocket() {
  const uid = useAuthStore((s) => s.user?.id ?? null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!uid) return;

    const socket: Socket = io(`${WS_BASE_URL}/notifications`, {
      // A *function* here (not a plain object) so socket.io-client reads
      // the token fresh on every connection attempt, including
      // automatic reconnects — the access token is short-lived
      // (JWT_ACCESS_EXPIRES_IN, 15m by default) and rotates via
      // apiClient's silent-refresh flow, so a value captured once at
      // mount time would go stale and get every later reconnect
      // rejected by JwtAuthGuard.
      auth: (callback) => callback({ token: useAuthStore.getState().accessToken }),
    });

    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: qk.notifications.list(uid) });
      void queryClient.invalidateQueries({ queryKey: qk.notifications.unreadCount(uid) });
    };

    socket.on("notification:new", invalidate);

    return () => {
      socket.off("notification:new", invalidate);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- queryClient is stable for the app's lifetime
  }, [uid]);
}
