"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { useUiStore } from "@/store/ui-store";
import { UserMenu } from "./user-menu";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";
import { AmbientModeToggle } from "./ambient-mode-toggle";
import { PushNotificationsButton } from "@/components/pwa/push-notifications-button";
import { Logo } from "./logo";

export function Topbar() {
  const router = useRouter();
  const { t, dir } = useTranslation();
  const openCommandPalette = useUiStore((s) => s.openCommandPalette);
  const navButton =
    "flex h-9 w-9 items-center justify-center rounded-full bg-surface text-muted transition-colors hover:text-foreground";

  // In RTL, "back" moves visually to the right and "forward" to the left —
  // the icons mirror even though the actions (router.back/forward) don't.
  const BackIcon = dir === "rtl" ? ChevronRight : ChevronLeft;
  const ForwardIcon = dir === "rtl" ? ChevronLeft : ChevronRight;

  return (
    <header className="sticky top-0 z-40 flex items-center gap-3 bg-background/80 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
      <Logo text="MELUNE" className="text-lg font-bold tracking-wide md:hidden" />

      <div className="hidden items-center gap-2 md:flex">
        <button onClick={() => router.back()} aria-label={t("nav.goBack")} className={navButton}>
          <BackIcon size={18} />
        </button>
        <button onClick={() => router.forward()} aria-label={t("nav.goForward")} className={navButton}>
          <ForwardIcon size={18} />
        </button>
      </div>

      <button
        onClick={openCommandPalette}
        aria-label={t("search.placeholder")}
        className="relative hidden min-w-0 max-w-md flex-1 items-center rounded-full border border-border bg-surface py-2.5 ps-10 pe-4 text-start text-sm text-muted transition-colors hover:border-primary/50 hover:text-foreground md:flex"
      >
        <Search size={16} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <span className="truncate">{t("search.placeholder")}</span>
        <kbd className="ms-auto hidden shrink-0 rounded-md border border-border bg-surfaceElevated px-1.5 py-0.5 text-[10px] lg:inline">
          ⌘K
        </kbd>
      </button>

      <div className="ms-auto flex items-center gap-2">
        <PushNotificationsButton />
        <AmbientModeToggle />
        <ThemeToggle />
        <LanguageSwitcher />
        <UserMenu />
      </div>
    </header>
  );
}
