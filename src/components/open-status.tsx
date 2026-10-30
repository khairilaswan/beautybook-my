"use client";

import { useIsClient } from "@/components/use-is-client";
import { isOpenAt } from "@/lib/hours";
import type { Closure, OpeningHours } from "@/lib/types";

export function OpenStatus({ hours, closures }: { hours: OpeningHours[]; closures: Closure[] }) {
  const isClient = useIsClient();
  if (!isClient || hours.length === 0) return null;
  const open = isOpenAt(hours, closures);
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-sm font-medium ${
        open ? "bg-green-50 text-whatsapp" : "bg-canvas text-muted"
      }`}
    >
      {open ? "Open now" : "Closed now"}
    </span>
  );
}
