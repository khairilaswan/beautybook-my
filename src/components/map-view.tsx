"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { listingPath } from "@/lib/paths";
import type { ListingCard } from "@/lib/types";

type Pin = Pick<ListingCard, "slug" | "name" | "lat" | "lng" | "area_name" | "is_featured">;

// OpenStreetMap tiles through Leaflet. Loaded only in the browser.
export function MapView({ listings, center }: { listings: Pin[]; center?: { lat: number; lng: number } }) {
  const el = useRef<HTMLDivElement>(null);
  const { t, href } = useI18n();
  const g = t.growth.search;
  const pins = listings.filter((l) => l.lat !== null && l.lng !== null);

  useEffect(() => {
    let disposed = false;
    let map: import("leaflet").Map | null = null;
    void import("leaflet").then((L) => {
      if (disposed || !el.current) return;
      map = L.map(el.current, { scrollWheelZoom: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      const points: [number, number][] = [];
      for (const p of pins) {
        const ll: [number, number] = [p.lat!, p.lng!];
        points.push(ll);
        const link = document.createElement("a");
        link.href = href(listingPath(p.slug));
        link.textContent = p.name;
        link.style.fontWeight = "600";
        const box = document.createElement("div");
        box.append(link);
        if (p.area_name) box.append(document.createElement("br"), p.area_name);
        L.circleMarker(ll, {
          radius: p.is_featured ? 10 : 8,
          color: "#fff",
          weight: 2,
          fillColor: p.is_featured ? "#111827" : "#db2777",
          fillOpacity: 0.95,
        })
          .bindPopup(box)
          .addTo(map);
      }
      if (center) {
        L.circleMarker([center.lat, center.lng], { radius: 6, color: "#2563eb", fillOpacity: 1 })
          .bindTooltip(g.youAreHere)
          .addTo(map);
        points.push([center.lat, center.lng]);
      }
      if (points.length > 1) map.fitBounds(points, { padding: [30, 30], maxZoom: 15 });
      else map.setView(points[0] ?? [3.139, 101.6869], points.length ? 15 : 11);
    });
    return () => {
      disposed = true;
      map?.remove();
    };
    // Rebuild when the set of results changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins.map((p) => p.slug).join(","), center?.lat, center?.lng]);

  return (
    <div>
      <div ref={el} className="h-[28rem] w-full overflow-hidden rounded-2xl border border-line bg-brand-50" />
      {pins.length < listings.length && (
        <p className="mt-2 text-xs text-muted">
          {fmt(g.noLocation, { count: listings.length - pins.length })}
        </p>
      )}
    </div>
  );
}
