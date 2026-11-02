"use client";

import { useEffect } from "react";

type Kind = "view" | "whatsapp" | "call" | "directions" | "website";

function send(listingId: string, kind: Kind) {
  const payload = JSON.stringify({ listingId, kind });
  if (!navigator.sendBeacon?.("/api/track", new Blob([payload], { type: "application/json" }))) {
    void fetch("/api/track", { method: "POST", body: payload, keepalive: true }).catch(() => {});
  }
}

function kindOf(link: HTMLAnchorElement): Kind | null {
  const explicit = link.dataset.track as Kind | undefined;
  if (explicit) return explicit;
  const href = link.getAttribute("href") ?? "";
  if (href.startsWith("https://wa.me/")) return "whatsapp";
  if (href.startsWith("tel:")) return "call";
  if (href.startsWith("https://www.google.com/maps")) return "directions";
  return null;
}

// One view per visit per shop, plus WhatsApp, call, directions and website
// clicks anywhere on the page.
export function TrackListing({ listingId }: { listingId: string }) {
  useEffect(() => {
    const key = `bb_viewed_${listingId}`;
    try {
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        send(listingId, "view");
      }
    } catch {
      send(listingId, "view");
    }
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.("a");
      const kind = link ? kindOf(link as HTMLAnchorElement) : null;
      if (kind) send(listingId, kind);
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [listingId]);
  return null;
}
