"use client";

import { Bell, BellOff, BellRing } from "lucide-react";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { useTranslation } from "@/hooks/use-translation";

/**
 * Bell toggle for Web Push (item 5, phase 8). Renders nothing when the
 * browser can't do push at all or nobody's signed in — same
 * "invisible until relevant" pattern as the rest of the shell icons.
 */
export function PushNotificationsButton() {
  const { state, busy, subscribe, unsubscribe } = usePushNotifications();
  const { t } = useTranslation();

  if (state === "unsupported" || state === "unauthenticated") return null;

  if (state === "denied") {
    return (
      <button
        disabled
        title={t("push.blockedHint")}
        aria-label={t("push.blockedHint")}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-muted/50"
      >
        <BellOff size={16} />
      </button>
    );
  }

  const subscribed = state === "subscribed";
  const label = subscribed ? t("push.disable") : t("push.enable");

  return (
    <button
      onClick={() => (subscribed ? unsubscribe() : subscribe())}
      disabled={busy}
      aria-label={label}
      aria-pressed={subscribed}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-surface transition-colors disabled:opacity-60 ${
        subscribed ? "text-primary" : "text-muted hover:text-foreground"
      }`}
    >
      {subscribed ? <BellRing size={16} /> : <Bell size={16} />}
    </button>
  );
}
