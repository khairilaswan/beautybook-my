// Languages, as on the website (src/lib/i18n/config.ts): English, Bahasa
// Melayu and Simplified Chinese.

export const LOCALES = ["en", "ms", "zh"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

// Intl formatting.
export const HTML_LANG: Record<Locale, string> = { en: "en-MY", ms: "ms-MY", zh: "zh-Hans-MY" };
// Each language's own name, for the switcher.
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", ms: "Bahasa Melayu", zh: "中文" };

// fmt("{count} shops in {area}", { count: 3, area: "Bangsar" })
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) => (key in vars ? String(vars[key]) : m));
}
