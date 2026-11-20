"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";

/**
 * Client-side route guard. Waits for the session check, then sends
 * guests to /login?next=<here> so they come back after signing in.
 * `isChecking` stays true until we know the user is logged in.
 *
 * Guest preview: appending `?guest=1` (or setting the
 * `melune:guest-preview` localStorage flag) keeps guests on the page so the
 * public home feed can be browsed without signing in. Write actions still
 * require authentication through the API.
 */
export function useRequireAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const ready = useAuthStore((s) => s.ready);
  const user = useAuthStore((s) => s.user);
  const [guestPreview, setGuestPreview] = useState(false);

  useEffect(() => {
    let guest = false;
    try {
      // The home feed is a public API endpoint ("guest visitor"), so /home is
      // browsable without an account. All other app routes keep the guard.
      guest =
        pathname === "/home" ||
        new URLSearchParams(window.location.search).has("guest") ||
        window.localStorage.getItem("melune:guest-preview") === "1";
    } catch {
      guest = false;
    }
    setGuestPreview(guest);
    if (ready && !user && !guest) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [ready, user, pathname, router]);

  return { user, isChecking: !ready || (!user && !guestPreview) };
}
