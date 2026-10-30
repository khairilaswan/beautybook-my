import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { UserMenu } from "@/components/user-menu";
import { siteUrl } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "BeautyBook: salons, barbers and beauty in Malaysia",
    template: "%s | BeautyBook",
  },
  description:
    "Find salons, barbers, nail and beauty studios across Klang Valley. See services and prices, then book on WhatsApp.",
  openGraph: { siteName: "BeautyBook", locale: "en_MY", type: "website" },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: "#c22c62",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-MY" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
            <Link href="/" className="text-lg font-bold tracking-tight">
              Beauty<span className="text-brand-600">Book</span>
            </Link>
            <nav className="ml-auto flex items-center gap-1 text-sm sm:gap-3">
              <Link href="/search" className="rounded-full px-3 py-1.5 hover:bg-brand-50">
                Explore
              </Link>
              <Link
                href="/for-business"
                className="hidden rounded-full px-3 py-1.5 hover:bg-brand-50 sm:inline-block"
              >
                For businesses
              </Link>
              <Suspense fallback={<span className="w-16" />}>
                <UserMenu />
              </Suspense>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="mt-16 border-t border-line bg-white">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm text-muted sm:grid-cols-3">
            <div>
              <p className="font-semibold text-ink">BeautyBook</p>
              <p className="mt-1">Salons, barbers and beauty across Klang Valley.</p>
            </div>
            <ul className="space-y-1">
              <li><Link href="/search" className="hover:text-ink">Explore shops</Link></li>
              <li><Link href="/for-business" className="hover:text-ink">Add or claim your business</Link></li>
            </ul>
            <ul className="space-y-1">
              <li><Link href="/privacy" className="hover:text-ink">Privacy and PDPA</Link></li>
              <li><Link href="/privacy#removal" className="hover:text-ink">Remove my listing</Link></li>
            </ul>
          </div>
        </footer>
      </body>
    </html>
  );
}
