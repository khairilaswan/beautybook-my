import { siteUrl } from "@/lib/env";
import { fmt } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export type BookingMessage = {
  shopName: string;
  serviceName: string;
  priceLabel: string | null;
  preferredLabel: string | null;
  customerName: string;
  note: string | null;
  shortCode: string;
  // In the customer's language: they send it from their own WhatsApp.
  words: Dictionary["booking"]["message"];
};

// The text the customer sends from their own WhatsApp. The link at the end
// lets the owner confirm the request and, if the shop is unclaimed, claim it.
export function bookingMessage(m: BookingMessage): string {
  const w = m.words;
  const lines = [
    fmt(w.greeting, { shop: m.shopName }),
    fmt(w.service, { service: `${m.serviceName}${m.priceLabel ? ` (${m.priceLabel})` : ""}` }),
    m.preferredLabel ? fmt(w.preferred, { time: m.preferredLabel }) : null,
    fmt(w.name, { name: m.customerName }),
    m.note ? fmt(w.note, { note: m.note }) : null,
    fmt(w.confirm, { url: `${siteUrl.replace(/^https?:\/\//, "")}/r/${m.shortCode}` }),
  ];
  return lines.filter(Boolean).join("\n");
}

export function whatsappLink(phone: string, text?: string): string {
  return `https://wa.me/${phone}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
