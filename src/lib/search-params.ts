import type { SearchParams } from "@/lib/types";

export type RawParams = Record<string, string | string[] | undefined>;

export const RADIUS_OPTIONS = [2, 5, 10, 25] as const;

// Reads /search query strings. Coordinates are rounded to about 100 m so
// cached results are shared and an exact location never sits in a URL.
export function parseSearchParams(raw: RawParams): SearchParams & { view: "list" | "map" } {
  const one = (k: string) => (Array.isArray(raw[k]) ? raw[k][0] : raw[k]) ?? undefined;
  const many = (k: string) => (Array.isArray(raw[k]) ? raw[k] : raw[k] ? [raw[k]] : []);
  const gender = one("for");
  const max = Number(one("max"));
  const [lat, lng] = (one("near") ?? "").split(",").map(Number);
  const near =
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && one("near")
      ? { lat: Math.round(lat * 1000) / 1000, lng: Math.round(lng * 1000) / 1000 }
      : undefined;
  const radius = Number(one("radius"));
  const sort = one("sort");
  return {
    q: one("q")?.slice(0, 100),
    category: one("category"),
    area: one("area"),
    mall: one("mall"),
    attributes: many("attr").slice(0, 10),
    gender: gender === "men" || gender === "women" ? gender : undefined,
    openNow: one("open") === "1",
    openLate: one("late") === "1",
    maxPrice: Number.isFinite(max) && max > 0 ? Math.min(max, 100000) : undefined,
    near,
    radiusKm: near ? ((RADIUS_OPTIONS as readonly number[]).includes(radius) ? radius : 10) : undefined,
    sort: sort === "price" || sort === "distance" ? sort : undefined,
    page: Number(one("page")) || 1,
    view: one("view") === "map" ? "map" : "list",
  };
}

export function searchQueryString(params: ReturnType<typeof parseSearchParams>, changes: Record<string, string | null> = {}): string {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.category) qs.set("category", params.category);
  if (params.area) qs.set("area", params.area);
  if (params.mall) qs.set("mall", params.mall);
  params.attributes?.forEach((a) => qs.append("attr", a));
  if (params.gender) qs.set("for", params.gender);
  if (params.openNow) qs.set("open", "1");
  if (params.openLate) qs.set("late", "1");
  if (params.maxPrice) qs.set("max", String(params.maxPrice));
  if (params.near) qs.set("near", `${params.near.lat},${params.near.lng}`);
  if (params.near && params.radiusKm) qs.set("radius", String(params.radiusKm));
  if (params.sort) qs.set("sort", params.sort);
  if (params.view === "map") qs.set("view", "map");
  for (const [k, v] of Object.entries(changes)) {
    if (v === null) qs.delete(k);
    else qs.set(k, v);
  }
  return qs.toString();
}
