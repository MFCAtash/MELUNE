"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@melune/api-client";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { useNotificationsSocket } from "@/hooks/use-notifications-socket";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        // Never retry client errors (401/403/404) — they won't change.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
          failureCount < 2,
      },
    },
  });
}

/**
 * Runs the one-time session check: if we have no user in memory, try
 * /users/me (which transparently attempts a silent refresh via the
 * httpOnly cookie). Whatever happens, flips `ready` so guards and the
 * landing redirect can stop waiting.
 */
function SessionBootstrap() {
  useEffect(() => {
    const { user, setSession, setReady } = useAuthStore.getState();
    if (user) {
      setReady();
      return;
    }
    apiClient
      .getMe()
      .then((me) => setSession(me, useAuthStore.getState().accessToken))
      .catch(() => undefined)
      .finally(setReady);
  }, []);
  return null;
}

/** Never let one account's cached data leak into another session in the
 *  same tab (e.g. a session expires and someone else logs in). */
function ClearCacheOnUserChange({ queryClient }: { queryClient: QueryClient }) {
  useEffect(
    () =>
      useAuthStore.subscribe((state, prev) => {
        if (prev.user && state.user?.id !== prev.user.id) queryClient.clear();
      }),
    [queryClient],
  );
  return null;
}

/** Bridge component: `useNotificationsSocket` needs to run inside
 *  <QueryClientProvider>, so it can't just be called from `Providers`
 *  itself before that provider renders. */
function NotificationsSocketBridge() {
  useNotificationsSocket();
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  // @types/react exists twice in this workspace (a newer copy for the app, an
  // older one hoisted for @tanstack/react-query), so the two `ReactNode`
  // types are structurally identical but nominally different. Same runtime
  // value — bridge the type at this single boundary.
  const content = children as unknown as React.ComponentProps<
    typeof QueryClientProvider
  >["children"];
  return (
    <QueryClientProvider client={queryClient}>
      <SessionBootstrap />
      <ClearCacheOnUserChange queryClient={queryClient} />
      <NotificationsSocketBridge />
      {content}
    </QueryClientProvider>
  );
}
