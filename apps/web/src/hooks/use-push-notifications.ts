"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { pushSupported, urlBase64ToUint8Array } from "@/lib/push";
import { useAuthStore } from "@/store/auth-store";

export type PushUiState = "unsupported" | "unauthenticated" | "denied" | "subscribed" | "unsubscribed";

/**
 * Owns the browser-side half of Web Push: checking the current
 * permission/subscription, subscribing (asks for Notification
 * permission, registers with the browser's push service via the
 * already-registered service worker, then hands the subscription to
 * the API), and unsubscribing on both ends.
 *
 * Deliberately does *not* auto-prompt on mount — asking for
 * notification permission the instant someone lands on the app is a
 * classic way to get permanently denied. It's surfaced as an explicit
 * button (see PushNotificationsButton) instead.
 */
export function usePushNotifications() {
  const user = useAuthStore((s) => s.user);
  const [state, setState] = useState<PushUiState>("unsupported");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!pushSupported()) {
      setState("unsupported");
      return;
    }
    if (!user) {
      setState("unauthenticated");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      setState(existing ? "subscribed" : "unsubscribed");
    } catch {
      setState("unsubscribed");
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const subscribe = useCallback(async () => {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!pushSupported() || !user || !publicKey) return;

    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "unsubscribed");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));

      const json = subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await apiClient.subscribeToPush({
        endpoint: json.endpoint,
        keys: json.keys,
        userAgent: navigator.userAgent,
      });
      setState("subscribed");
    } catch {
      // Best-effort feature — leave state as whatever refresh() would
      // report rather than surfacing a hard error to the listener.
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [user, refresh]);

  const unsubscribe = useCallback(async () => {
    if (!pushSupported()) return;
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await apiClient.unsubscribeFromPush(endpoint).catch(() => undefined);
      }
      setState("unsubscribed");
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, subscribe, unsubscribe };
}
