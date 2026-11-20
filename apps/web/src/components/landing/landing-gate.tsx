"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";

/**
 * Smart redirect for "/": logged-in users go straight to /home, guests
 * see the landing page. While the session check is in flight a splash
 * covers the page, so returning users never see the marketing content
 * flash before being redirected. (The landing HTML is still server-
 * rendered underneath, so crawlers see it.)
 */
export function LandingGate() {
  const router = useRouter();
  const ready = useAuthStore((s) => s.ready);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (ready && user) router.replace("/home");
  }, [ready, user, router]);

  if (ready && !user) return null;

  return (
    <div
      role="status"
      aria-label="Loading"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-background"
    >
      <span className="brand-wordmark font-brand text-2xl font-semibold motion-safe:animate-pulse">
        MELUNE
      </span>
    </div>
  );
}
