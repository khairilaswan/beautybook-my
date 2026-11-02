// Locales, URL rules and hreflang. Safe to import anywhere (server, client,
// proxy). English is unprefixed (/salon/x); the others carry a prefix
// (/ms/salon/x, /zh/salon/x). Slugs are the same in every language.

export const LOCALES = ["en", "ms", "zh"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

// Set by src/proxy.ts on every request, so server actions and route handlers
// (which can't read root params) still know the visitor's language.
export const LOCALE_HEADER = "x-bb-locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

// hreflang values (language-region, the form Google documents). The
// Chinese pages are Simplified, as used in Malaysian schools and press;
// <html lang> says so with zh-Hans.
export const HREFLANG: Record<Locale, string> = { en: "en-MY", ms: "ms-MY", zh: "zh-MY" };
// <html lang> and Intl formatting.
export const HTML_LANG: Record<Locale, string> = { en: "en-MY", ms: "ms-MY", zh: "zh-Hans-MY" };
export const OG_LOCALE: Record<Locale, string> = { en: "en_MY", ms: "ms_MY", zh: "zh_MY" };
// Each language's own name, for the switcher.
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", ms: "Bahasa Melayu", zh: "中文" };
export const LOCALE_SHORT: Record<Locale, string> = { en: "EN", ms: "BM", zh: "中文" };

// "/salon/x?y=1" -> "/ms/salon/x?y=1" for ms; unchanged for English.
export function localePath(locale: Locale, path: string): string {
  if (locale === DEFAULT_LOCALE || !path.startsWith("/") || path.startsWith("//")) return path;
  if (path === "/") return `/${locale}`;
  if (path.startsWith("/?") || path.startsWith("/#")) return `/${locale}${path.slice(1)}`;
  return `/${locale}${path}`;
}

// "/ms/salon/x" -> { locale: "ms", path: "/salon/x" }. "/en/..." also
// parses, so the proxy can send it to the unprefixed address.
export function splitLocale(pathname: string): { locale: Locale | null; path: string } {
  const first = pathname.split("/")[1] ?? "";
  if (isLocale(first)) {
    const rest = pathname.slice(first.length + 1);
    return { locale: first, path: rest === "" ? "/" : rest };
  }
  return { locale: null, path: pathname };
}

// Metadata alternates for a page that exists in every language: the
// canonical is this language's own URL, plus one hreflang per language and
// x-default pointing at English.
export function alternatesFor(locale: Locale, path: string) {
  return {
    canonical: localePath(locale, path),
    languages: languageAlternates(path),
  };
}

export function languageAlternates(path: string, toUrl: (p: string) => string = (p) => p): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[HREFLANG[l]] = toUrl(localePath(l, path));
  languages["x-default"] = toUrl(path);
  return languages;
}

// fmt("{count} shops in {area}", { count: 3, area: "Bangsar" })
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) => (key in vars ? String(vars[key]) : m));
}
