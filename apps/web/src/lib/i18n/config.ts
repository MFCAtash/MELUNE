export type Locale = "en" | "fa";
export type Direction = "ltr" | "rtl";

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALES: readonly Locale[] = ["en", "fa"];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fa: "فارسی",
};

const RTL_LOCALES: ReadonlySet<Locale> = new Set(["fa"]);

export function localeDirection(locale: Locale): Direction {
  return RTL_LOCALES.has(locale) ? "rtl" : "ltr";
}

export function isLocale(value: string | null | undefined): value is Locale {
  return value !== null && value !== undefined && (LOCALES as readonly string[]).includes(value);
}
