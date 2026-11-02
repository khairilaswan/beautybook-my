import type { Locale } from "@/lib/i18n/config";
import { localDate } from "@/lib/i18n/names";
import type { Service } from "@/lib/types";

// Same labels as the website's src/lib/format.ts.
const FROM: Record<Locale, (price: string) => string> = {
  en: (p) => `from ${p}`,
  ms: (p) => `dari ${p}`,
  zh: (p) => `${p} 起`,
};

export function rm(n: number): string {
  return `RM${Number.isInteger(n) ? n : n.toFixed(2)}`;
}

export function priceLabel(s: Pick<Service, "price_from" | "price_to">, locale: Locale = "en"): string | null {
  const from = s.price_from === null ? null : Number(s.price_from);
  const to = s.price_to === null ? null : Number(s.price_to);
  if (from === null) return null;
  if (to === null || to === from) return FROM[locale](rm(from));
  return `${rm(from)} – ${rm(to)}`;
}

// "RM60–90", "from RM60", or null when the shop has no prices yet.
export function priceRangeLabel(min: number | null, max: number | null, locale: Locale = "en"): string | null {
  if (min === null) return null;
  if (max === null || max === min) return FROM[locale](rm(min));
  return `${rm(min)}–${Number.isInteger(max) ? max : max.toFixed(2)}`;
}

export function priceLevelLabel(level: number | null): string | null {
  return level ? "$".repeat(level) : null;
}

export function formatDate(iso: string, locale: Locale = "en"): string {
  return localDate(iso, locale);
}

export function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export function whatsappLink(phone: string, text?: string): string {
  return `https://wa.me/${phone}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
