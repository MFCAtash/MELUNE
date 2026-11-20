"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";

/**
 * Client-side guard for the /admin section. Mirrors `useRequireAuth`
 * (redirect guests to /login) but additionally bounces anyone who isn't
 * `role === "ADMIN"` back to the home feed — the real enforcement is
 * server-side (`@Roles(Role.ADMIN)` on every admin/catalog-write
 * endpoint), this is just so a non-admin never sees the admin chrome
 * flash before their first API call 403s.
 */
export function useRequireAdmin() {
  const router = useRouter();
  const ready = useAuthStore((s) => s.ready);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login?next=/admin");
      return;
    }
    if (user.role !== "ADMIN") {
      router.replace("/home");
    }
  }, [ready, user, router]);

  const isChecking = !ready || !user || user.role !== "ADMIN";
  return { user, isChecking };
}
