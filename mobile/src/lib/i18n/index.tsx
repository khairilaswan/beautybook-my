import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LOCALE, type Locale, isLocale } from "@/lib/i18n/config";
import { type Dictionary, en } from "@/lib/i18n/en";
import { ms } from "@/lib/i18n/ms";
import { zh } from "@/lib/i18n/zh";

export { fmt } from "@/lib/i18n/config";
export type { Locale };

const DICTIONARIES: Record<Locale, Dictionary> = { en, ms, zh };
const STORAGE_KEY = "bb.locale";

// The phone's language when it is one we support, else English.
function deviceLocale(): Locale {
  for (const l of getLocales()) {
    if (isLocale(l.languageCode)) return l.languageCode;
  }
  return DEFAULT_LOCALE;
}

type I18nValue = { locale: Locale; t: Dictionary; setLocale: (locale: Locale) => void };

const I18nContext = createContext<I18nValue>({ locale: DEFAULT_LOCALE, t: en, setLocale: () => {} });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(deviceLocale);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (isLocale(saved)) setLocaleState(saved);
      })
      .catch(() => {});
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo(() => ({ locale, t: DICTIONARIES[locale], setLocale }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}
