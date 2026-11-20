"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  BarChart3,
  ChevronLeft,
  Disc3,
  FileText,
  LayoutDashboard,
  ListMusic,
  Mic2,
  Users,
} from "lucide-react";
import { useRequireAdmin } from "@/hooks/use-require-admin";
import { useTranslation } from "@/hooks/use-translation";
import type { TranslationKey } from "@/lib/i18n/translate";

const NAV: { href: string; labelKey: TranslationKey; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { href: "/admin", labelKey: "admin.nav.dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", labelKey: "admin.nav.users", icon: Users },
  { href: "/admin/songs", labelKey: "admin.nav.songs", icon: ListMusic },
  { href: "/admin/albums", labelKey: "admin.nav.albums", icon: Disc3 },
  { href: "/admin/catalog", labelKey: "admin.nav.catalog", icon: Mic2 },
  { href: "/admin/analytics", labelKey: "admin.nav.analytics", icon: BarChart3 },
  { href: "/admin/lyrics", labelKey: "admin.nav.lyrics", icon: FileText },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { isChecking } = useRequireAdmin();
  const pathname = usePathname();
  const { t, dir } = useTranslation();

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        {t("admin.nav.checkingAccess")}
      </div>
    );
  }

  return (
    <div dir={dir} className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-60 shrink-0 flex-col border-e border-border bg-surface p-4 md:flex">
        <Link
          href="/home"
          className="mb-6 flex items-center gap-2 text-sm text-muted hover:text-foreground"
        >
          <ChevronLeft size={16} />
          {t("admin.nav.backToApp")}
        </Link>

        <div className="mb-4 px-2">
          <span className="bg-melune-gradient bg-clip-text text-lg font-bold tracking-wide text-transparent">
            {t("admin.nav.panelTitle")}
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(({ href, labelKey, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-melune-gradient text-white"
                    : "text-muted hover:bg-surfaceElevated hover:text-foreground"
                }`}
              >
                <Icon size={17} />
                {t(labelKey)}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border pt-3 text-xs text-muted">
          MELUNE — Admin · Phase 8.2
        </div>
      </aside>

      {/* Mobile top nav */}
      <nav className="fixed inset-x-0 top-0 z-40 flex items-center gap-1 overflow-x-auto border-b border-border bg-surface/95 px-3 py-2 backdrop-blur md:hidden">
        {NAV.map(({ href, labelKey, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ${
                active ? "bg-melune-gradient text-white" : "text-muted"
              }`}
            >
              <Icon size={14} />
              {t(labelKey)}
            </Link>
          );
        })}
      </nav>

      <main className="min-w-0 flex-1 p-4 pt-16 sm:p-6 md:pt-6 lg:p-8">{children}</main>
    </div>
  );
}
