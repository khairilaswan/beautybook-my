import type { Occasion, PackageKind } from "@/lib/types";

export const OCCASION_LABELS: Record<Occasion, string> = {
  raya: "Hari Raya",
  cny: "Chinese New Year",
  deepavali: "Deepavali",
  christmas: "Christmas",
  merdeka: "Merdeka",
  wedding: "Wedding season",
  other: "Special offer",
};

export const PACKAGE_KIND_LABELS: Record<PackageKind, string> = {
  bridal: "Bridal",
  event: "Event",
  group: "Group",
  other: "Package",
};

export const EVENT_TYPES = ["wedding", "engagement", "dinner", "photoshoot", "graduation", "other"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  wedding: "Wedding (nikah / sanding / reception)",
  engagement: "Engagement (tunang)",
  dinner: "Dinner or party",
  photoshoot: "Photoshoot",
  graduation: "Graduation",
  other: "Something else",
};

export const QUOTE_STATUS_LABELS: Record<string, string> = {
  sent: "New",
  quoted: "Quote sent",
  booked: "Booked",
  declined: "Declined",
};
