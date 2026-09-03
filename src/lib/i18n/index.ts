import { en, type Dictionary } from "./en";
import { ur } from "./ur";
import { zh } from "./zh";

/* ============================================================
   LOCALES
   One language at a time. Nothing on any screen mixes two.
   Client-safe: no next/headers here — see ./server for that.
   ============================================================ */

export const LOCALES = ["en", "ur", "zh"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "awaaz_locale";

const DICTIONARIES: Record<Locale, Dictionary> = { en, ur, zh };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/** Fill {placeholders}. Keeps sentence structure inside the dictionary,
    where a translator can move the variable to where the grammar needs it. */
export function fmt(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in vars ? String(vars[key]) : "",
  );
}

/** Locale-correct digits. Urdu reads eastern-Arabic numerals naturally,
    but tracking numbers and coordinates must stay machine-legible, so
    this is applied to prose counts only. */
export function num(n: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "ur" ? "ur-PK" : locale === "zh" ? "zh-CN" : "en-GB").format(n);
}

export type { Dictionary };
