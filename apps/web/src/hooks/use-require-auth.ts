"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";

/**
 * Client-side route guard. Waits for the session check, then sends
 * guests to /login?next=<here> so they come back after signing in.
 * `isChecking` stays true until we know the user is logged in.
 */
export function useRequireAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const ready = useAuthStore((s) => s.ready);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (ready && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [ready, user, pathname, router]);

  return { user, isChecking: !ready || !user };
}
