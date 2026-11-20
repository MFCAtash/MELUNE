import { en } from "./locales/en";
import { fa } from "./locales/fa";
import type { Locale } from "./config";
import type { Dictionary } from "./locales/en";

export const DICTIONARIES: Record<Locale, Dictionary> = { en, fa };

/** Every dot-separated path through the dictionary, e.g. "player.play". */
type PathsOf<T, Prefix extends string = ""> = T extends string
  ? Prefix extends `${infer P}.`
    ? P
    : never
  : {
      [K in keyof T & string]: PathsOf<T[K], `${Prefix}${K}.`>;
    }[keyof T & string];

export type TranslationKey = PathsOf<Dictionary>;

function lookup(dict: Dictionary, key: string): string {
  const value = key
    .split(".")
    .reduce<unknown>((node, segment) => (node as Record<string, unknown> | undefined)?.[segment], dict);
  return typeof value === "string" ? value : key;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/**
 * Resolves `key` (e.g. "queue.moveUp") in `locale`'s dictionary, falling
 * back to English for any key a locale hasn't defined yet, and finally to
 * the raw key itself so a typo shows up in the UI instead of crashing it.
 */
export function translate(
  locale: Locale,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  const primary = lookup(DICTIONARIES[locale], key);
  const resolved = primary !== key ? primary : lookup(DICTIONARIES.en, key);
  return interpolate(resolved, vars);
}
