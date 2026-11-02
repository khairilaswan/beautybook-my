"use client";

import { createContext, useContext, useMemo } from "react";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { type Locale, localePath } from "@/lib/i18n/config";

type Value = { locale: Locale; t: Dictionary; href: (path: string) => string };

const I18nContext = createContext<Value | null>(null);

// Sits in the root layout with the current language's dictionary.
export function I18nProvider({ locale, t, children }: { locale: Locale; t: Dictionary; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, t, href: (path: string) => localePath(locale, path) }), [locale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// For Client Components: const { t, href, locale } = useI18n().
export function useI18n(): Value {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside <I18nProvider>");
  return value;
}
