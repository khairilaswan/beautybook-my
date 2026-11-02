import type { Metadata, Viewport } from "next";
import { Inter_Tight, Manrope, Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemePreviewBar } from "@/components/theme-preview-bar";
import { UserMenu } from "@/components/user-menu";
import { getSiteTheme } from "@/lib/data/site-theme";
import { siteUrl } from "@/lib/env";
import { HTML_LANG, LOCALES, OG_LOCALE, alternatesFor } from "@/lib/i18n/config";
import { I18nProvider } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";
import { paletteCss, themeColorHex } from "@/lib/themes";
import "../globals.css";

// One font per theme style. Not preloaded: the browser only downloads the one
// the current theme uses.
const glassFont = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--ff-glass", preload: false });
const brutalFont = Space_Grotesk({ subsets: ["latin"], variable: "--ff-brutal", preload: false });
const minimalFont = Manrope({ subsets: ["latin"], variable: "--ff-minimal", preload: false });
const swissFont = Inter_Tight({ subsets: ["latin"], variable: "--ff-swiss", preload: false });
const fontVars = [glassFont, brutalFont, minimalFont, swissFont].map((f) => f.variable).join(" ");
const PALETTE_CSS = paletteCss();

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getI18n();
  return {
    metadataBase: new URL(siteUrl),
    title: { default: t.meta.defaultTitle, template: "%s | BeautyBook" },
    description: t.meta.description,
    openGraph: {
      siteName: "BeautyBook",
      locale: OG_LOCALE[locale],
      alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
      type: "website",
    },
    alternates: alternatesFor(locale, "/"),
  };
}

export async function generateViewport(): Promise<Viewport> {
  return { themeColor: themeColorHex(await getSiteTheme()) };
}

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const [theme, { locale, t, href }] = await Promise.all([getSiteTheme(), getI18n()]);
  return (
    <html lang={HTML_LANG[locale]} className={`h-full antialiased ${fontVars}`}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: PALETTE_CSS }} />
      </head>
      <body className="flex min-h-full flex-col" data-style={theme.style} data-color={theme.color}>
        <I18nProvider locale={locale} t={t}>
        <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:gap-4">
            <Link href={href("/")} className="shrink-0 text-base font-bold tracking-tight sm:text-lg">
              Beauty<span className="text-brand-600">Book</span>
            </Link>
            <nav className="ml-auto flex items-center gap-1 whitespace-nowrap text-sm sm:gap-3">
              <Link
                href={href("/search")}
                aria-label={t.nav.explore}
                className="rounded-full px-2 py-1.5 hover:bg-brand-50 sm:px-3"
              >
                {/* An icon on phones leaves room for the language switcher. */}
                <svg aria-hidden viewBox="0 0 20 20" className="size-5 sm:hidden" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="9" cy="9" r="6" />
                  <path d="m14 14 4 4" strokeLinecap="round" />
                </svg>
                <span className="hidden sm:inline">{t.nav.explore}</span>
              </Link>
              <Link
                href={href("/for-business")}
                className="hidden rounded-full px-3 py-1.5 hover:bg-brand-50 sm:inline-block"
              >
                {t.nav.forBusiness}
              </Link>
              <Suspense fallback={<span className="w-16" />}>
                <UserMenu />
              </Suspense>
              <LanguageSwitcher />
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="mt-16 border-t border-line bg-white">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm text-muted sm:grid-cols-3">
            <div>
              <p className="font-semibold text-ink">BeautyBook</p>
              <p className="mt-1">{t.footer.tagline}</p>
            </div>
            <ul className="space-y-1">
              <li><Link href={href("/search")} className="hover:text-ink">{t.footer.explore}</Link></li>
              <li><Link href={href("/for-business")} className="hover:text-ink">{t.footer.addOrClaim}</Link></li>
            </ul>
            <ul className="space-y-1">
              <li><Link href={href("/privacy")} className="hover:text-ink">{t.footer.privacy}</Link></li>
              <li><Link href={href("/privacy#removal")} className="hover:text-ink">{t.footer.removeListing}</Link></li>
            </ul>
          </div>
        </footer>
        <ThemePreviewBar />
        </I18nProvider>
      </body>
    </html>
  );
}
