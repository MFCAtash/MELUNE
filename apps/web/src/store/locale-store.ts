import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_LOCALE, localeDirection, type Locale } from "@/lib/i18n/config";

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

/**
 * Persisted client-side language preference. The no-flash inline script in
 * the root layout reads the same "melune-locale" localStorage key before
 * hydration to set `<html lang/dir>` synchronously — see layout.tsx.
 */
export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: DEFAULT_LOCALE,
      setLocale: (locale) => {
        set({ locale });
        if (typeof document !== "undefined") {
          document.documentElement.lang = locale;
          document.documentElement.dir = localeDirection(locale);
        }
      },
    }),
    { name: "melune-locale" },
  ),
);
