"use client";

import { X } from "lucide-react";
import { PLAYER_SHORTCUTS } from "@/lib/shortcuts";
import { useTranslation } from "@/hooks/use-translation";

/** Renders a `key` chip the way it should read for the current keyboard,
 *  e.g. " " -> "Space", "arrowright" -> "→". */
function keyLabel(rawKey: string): string {
  const map: Record<string, string> = {
    " ": "Space",
    spacebar: "Space",
    arrowright: "→",
    arrowleft: "←",
    arrowup: "↑",
    arrowdown: "↓",
  };
  const lower = rawKey.toLowerCase();
  return map[lower] ?? rawKey.toUpperCase();
}

export function ShortcutsHelpDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-help-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between gap-4">
          <div>
            <h2 id="shortcuts-help-title" className="text-lg font-semibold text-foreground">
              {t("shortcuts.title")}
            </h2>
            <p className="mt-1 text-xs text-muted">{t("shortcuts.subtitle")}</p>
          </div>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className="shrink-0 rounded-full p-1.5 text-muted transition-colors hover:bg-surfaceElevated hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <ul className="mt-4 divide-y divide-border">
          {PLAYER_SHORTCUTS.map((shortcut) => (
            <li key={shortcut.id} className="flex items-center justify-between gap-4 py-2.5">
              <span className="text-sm text-foreground">{t(shortcut.labelKey)}</span>
              <span className="flex shrink-0 items-center gap-1">
                {shortcut.shift && (
                  <kbd className="rounded-md border border-border bg-surfaceElevated px-2 py-1 text-xs text-muted">
                    Shift
                  </kbd>
                )}
                {shortcut.keys.slice(0, 1).map((k) => (
                  <kbd
                    key={k}
                    className="rounded-md border border-border bg-surfaceElevated px-2 py-1 text-xs text-muted"
                  >
                    {keyLabel(k)}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
