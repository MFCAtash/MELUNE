"use client";

import { Languages } from "lucide-react";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n/config";
import { useTranslation } from "@/hooks/use-translation";

/**
 * A plain toggle rather than a dropdown — there are only two locales today,
 * and this stays trivial to extend into a `<select>` if a third arrives.
 */
export function LanguageSwitcher() {
  const { t, locale, setLocale } = useTranslation();
  const next = LOCALES.find((l) => l !== locale) ?? locale;

  return (
    <button
      onClick={() => setLocale(next)}
      aria-label={`${t("common.language")}: ${LOCALE_LABELS[next]}`}
      title={`${t("common.language")}: ${LOCALE_LABELS[next]}`}
      className="flex h-9 items-center gap-1.5 rounded-full bg-surface px-3 text-xs font-medium text-muted transition-colors hover:text-foreground"
    >
      <Languages size={15} />
      {locale.toUpperCase()}
    </button>
  );
}
