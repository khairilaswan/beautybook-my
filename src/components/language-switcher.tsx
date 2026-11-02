"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { LOCALES, LOCALE_NAMES, LOCALE_SHORT, localePath, splitLocale } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";

// Links to this same page in each language. Plain <a> tags: switching
// language reloads the page so <html lang> and the header follow.
export function LanguageSwitcher() {
  return (
    <Suspense fallback={<Links path="/" search="" />}>
      <ForThisPage />
    </Suspense>
  );
}

// The URL is only known at request time, so prerendered HTML links each
// language's home page until this streams in.
function ForThisPage() {
  const { path } = splitLocale(usePathname());
  const search = useSearchParams().toString();
  return <Links path={path} search={search ? `?${search}` : ""} />;
}

function Links({ path, search }: { path: string; search: string }) {
  const { locale, t } = useI18n();
  return (
    <ul aria-label={t.nav.language} className="flex items-center rounded-full border border-line p-0.5 text-xs">
      {LOCALES.map((l) => (
        <li key={l}>
          <a
            href={`${localePath(l, path)}${search}`}
            hrefLang={l}
            lang={l}
            title={LOCALE_NAMES[l]}
            aria-current={l === locale ? "true" : undefined}
            className={`block rounded-full px-1.5 py-1 sm:px-2 ${
              l === locale ? "bg-ink font-medium text-white" : "text-muted hover:text-ink"
            }`}
          >
            {LOCALE_SHORT[l]}
          </a>
        </li>
      ))}
    </ul>
  );
}
