"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Library, LogOut, ShieldCheck } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { usePlayerStore } from "@/store/player-store";
import { useTranslation } from "@/hooks/use-translation";
import { Cover } from "@/components/ui/cover";

export function UserMenu() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!ready) return <div className="h-9 w-9 rounded-full bg-surfaceElevated motion-safe:animate-pulse" />;

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/login" className="rounded-full px-4 py-2 text-sm text-foreground hover:text-primary">
          {t("nav.logIn")}
        </Link>
        <Link
          href="/register"
          className="bg-codex-gradient rounded-full px-4 py-2 text-sm font-medium text-white"
        >
          {t("nav.signUp")}
        </Link>
      </div>
    );
  }

  const logout = async () => {
    setOpen(false);
    await apiClient.logout().catch(() => undefined);
    usePlayerStore.getState().pause();
    useAuthStore.getState().clear();
    queryClient.clear(); // never leak one account's cached data into the next
    router.replace("/login");
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("nav.account")}
        className="block h-9 w-9 overflow-hidden rounded-full ring-2 ring-transparent transition hover:ring-primary focus-visible:ring-primary"
      >
        <Cover title={user.username} url={user.avatarUrl} seed={user.id} className="h-9 w-9 rounded-full text-sm" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute end-0 top-full z-30 mt-2 w-56 rounded-xl border border-border bg-surfaceElevated p-1.5 shadow-glow"
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium text-foreground">{user.username}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <div className="my-1 border-t border-border" />
          <Link
            href="/library"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-surface"
          >
            <Library size={16} /> {t("nav.yourLibrary")}
          </Link>
          {user.role === "ADMIN" && (
            <Link
              href="/admin"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-surface"
            >
              <ShieldCheck size={16} /> پنل مدیریت
            </Link>
          )}
          <button
            role="menuitem"
            onClick={logout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start text-sm text-foreground hover:bg-surface"
          >
            <LogOut size={16} /> {t("nav.logOut")}
          </button>
        </div>
      )}
    </div>
  );
}
