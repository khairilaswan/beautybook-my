import { siteUrl } from "@/lib/env";

export type BookingMessage = {
  shopName: string;
  serviceName: string;
  priceLabel: string | null;
  preferredLabel: string | null;
  customerName: string;
  note: string | null;
  shortCode: string;
};

// The text the customer sends from their own WhatsApp. The link at the end
// lets the owner confirm the request and, if the shop is unclaimed, claim it.
export function bookingMessage(m: BookingMessage): string {
  const lines = [
    `Hi ${m.shopName}! Booking request via BeautyBook.my`,
    `Service: ${m.serviceName}${m.priceLabel ? ` (${m.priceLabel})` : ""}`,
    m.preferredLabel ? `Preferred time: ${m.preferredLabel}` : null,
    `Name: ${m.customerName}`,
    m.note ? `Note: ${m.note}` : null,
    `Confirm here: ${siteUrl.replace(/^https?:\/\//, "")}/r/${m.shortCode}`,
  ];
  return lines.filter(Boolean).join("\n");
}

export function whatsappLink(phone: string, text?: string): string {
  return `https://wa.me/${phone}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
