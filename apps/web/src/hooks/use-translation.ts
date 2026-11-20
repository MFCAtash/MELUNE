"use client";

import { useCallback } from "react";
import { useLocaleStore } from "@/store/locale-store";
import { localeDirection } from "@/lib/i18n/config";
import { translate, type TranslationKey } from "@/lib/i18n/translate";

/**
 * `const { t, locale, dir } = useTranslation();`
 *
 * `t` is stable across renders unless the locale changes, so it's safe to
 * drop into dependency arrays without re-running effects on every render.
 */
export function useTranslation() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  );

  return { t, locale, setLocale, dir: localeDirection(locale) };
}
