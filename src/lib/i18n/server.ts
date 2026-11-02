import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { DICTIONARIES, type Dictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, LOCALES, LOCALE_HEADER, type Locale, isLocale, localePath } from "@/lib/i18n/config";

export type I18n = {
  locale: Locale;
  t: Dictionary;
  // Prefixes an internal path with the current language: href("/search").
  href: (path: string) => string;
};

function i18nFor(locale: Locale): I18n {
  return { locale, t: DICTIONARIES[locale], href: (path) => localePath(locale, path) };
}

// For Server Components, layouts, pages and generateMetadata: reads the
// [lang] root param, so it works inside "use cache" too.
export async function getLocale(): Promise<Locale> {
  const value = await lang();
  if (!isLocale(value)) notFound();
  return value;
}

export async function getI18n(): Promise<I18n> {
  return i18nFor(await getLocale());
}

// For Server Actions, route handlers and helpers they share with pages
// (root params aren't available there). Reads the header the proxy sets.
export async function getRequestLocale(): Promise<Locale> {
  const value = (await headers()).get(LOCALE_HEADER);
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getActionI18n(): Promise<I18n> {
  return i18nFor(await getRequestLocale());
}

// Pages live at /[lang]/...; revalidatePath("/account") alone would miss them.
export function revalidateLocalized(path: string, type?: "layout" | "page") {
  for (const l of LOCALES) revalidatePath(`/${l}${path === "/" ? "" : path}`, type);
}

// "/login?next=..." in the visitor's language, for redirect() in actions.
export async function localizedPath(path: string): Promise<string> {
  return localePath(await getRequestLocale(), path);
}
