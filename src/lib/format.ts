import { supabaseUrl } from "@/lib/env";
import type { Service } from "@/lib/types";

export function priceLabel(s: Pick<Service, "price_from" | "price_to">): string | null {
  const from = s.price_from === null ? null : Number(s.price_from);
  const to = s.price_to === null ? null : Number(s.price_to);
  if (from === null) return null;
  const rm = (n: number) => `RM${Number.isInteger(n) ? n : n.toFixed(2)}`;
  if (to === null || to === from) return `from ${rm(from)}`;
  return `${rm(from)} – ${rm(to)}`;
}

export function priceLevelLabel(level: number | null): string | null {
  return level ? "$".repeat(level) : null;
}

export const GENDER_LABELS = { men: "Men", women: "Women", unisex: "Men & women" } as const;

export function photoUrl(storagePath: string): string {
  return `${supabaseUrl()}/storage/v1/object/public/listing-photos/${storagePath}`;
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}
