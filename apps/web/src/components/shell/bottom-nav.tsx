"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn } from "lucide-react";
import { NAV_ITEMS, isActive } from "@/lib/nav";
import { useAuthStore } from "@/store/auth-store";
import { useTranslation } from "@/hooks/use-translation";
import { NAV_ICONS } from "./nav-icons";

/** Floating pill nav for phones. The active tab expands to show its label. */
export function BottomNav() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const { t } = useTranslation();

  const item = "flex h-11 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-colors";

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-3 bottom-3 z-40 flex justify-around rounded-full border border-border bg-surface/95 p-1.5 shadow-glow backdrop-blur md:hidden"
    >
      {NAV_ITEMS.map((nav) => {
        const Icon = NAV_ICONS[nav.id];
        const active = isActive(pathname, nav.href);
        const label = t(nav.labelKey);
        if (nav.soon) {
          return (
            <span key={nav.id} aria-disabled="true" className={`${item} text-muted/40`}>
              <Icon size={20} />
              <span className="sr-only">
                {label} ({t("nav.soon")})
              </span>
            </span>
          );
        }
        return (
          <Link
            key={nav.id}
            href={nav.href}
            aria-current={active ? "page" : undefined}
            className={`${item} ${active ? "bg-primary text-white" : "text-muted"}`}
          >
            <Icon size={20} />
            <span className={active ? "" : "sr-only"}>{label}</span>
          </Link>
        );
      })}
      {ready && !user && (
        <Link href="/login" className={`${item} text-muted`}>
          <LogIn size={20} />
          <span className="sr-only">{t("nav.logIn")}</span>
        </Link>
      )}
    </nav>
  );
}
