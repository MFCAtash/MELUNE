"use client";

import { useEffect, useState } from "react";
import { Circle, Sparkles, Laptop, Contrast } from "lucide-react";
import { useAmbientThemeStore, type AmbientMode } from "@/store/ambient-theme-store";
import { useTranslation } from "@/hooks/use-translation";

const ICONS: Record<AmbientMode, typeof Circle> = {
  static: Circle,
  dynamic: Sparkles,
  system: Laptop,
  amoled: Contrast,
};

const LABEL_KEYS: Record<
  AmbientMode,
  "ambientModeStatic" | "ambientModeDynamic" | "ambientModeSystem" | "ambientModeAmoled"
> = {
  static: "ambientModeStatic",
  dynamic: "ambientModeDynamic",
  system: "ambientModeSystem",
  amoled: "ambientModeAmoled",
};

/**
 * Cycles dynamic → static → system → amoled → dynamic (see
 * `ambient-theme-store.ts` for what each mode does). Same shape as
 * `ThemeToggle` — single icon button, no dropdown — extended to four
 * states the same way `player-store.ts`'s repeat-mode button already
 * cycles multiple values off a single click.
 *
 * Same hydration guard as `ThemeToggle`: `persist` only rehydrates on
 * the client, a tick after mount, so this renders the default ("dynamic")
 * icon until `mounted` to avoid a server/client mismatch flash.
 */
export function AmbientModeToggle() {
  const [mounted, setMounted] = useState(false);
  const mode = useAmbientThemeStore((s) => s.mode);
  const cycleMode = useAmbientThemeStore((s) => s.cycleMode);
  const { t } = useTranslation();

  useEffect(() => setMounted(true), []);

  const effectiveMode: AmbientMode = mounted ? mode : "dynamic";
  const Icon = ICONS[effectiveMode];
  const label = `${t("common.ambientMode")}: ${t(`common.${LABEL_KEYS[effectiveMode]}`)}`;

  return (
    <button
      onClick={cycleMode}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-muted transition-colors hover:text-foreground"
    >
      <Icon size={16} />
    </button>
  );
}
