import type { Area, Mall } from "@/lib/types";

// The city a mall belongs to (Kuala Lumpur, Petaling Jaya…), for grouping.
export function mallCity(mall: Pick<Mall, "area_id">, areas: Area[]): Area | null {
  const area = areas.find((a) => a.id === mall.area_id);
  if (!area) return null;
  return area.type === "area" ? (areas.find((a) => a.id === area.parent_id) ?? area) : area;
}

// Malls grouped under their city, cities in the site's area order, malls by name.
export function mallGroups<M extends Mall>(malls: M[], areas: Area[]): { city: Area | null; malls: M[] }[] {
  const groups = new Map<number, { city: Area | null; malls: M[] }>();
  for (const m of malls) {
    const city = mallCity(m, areas);
    const key = city?.id ?? 0;
    if (!groups.has(key)) groups.set(key, { city, malls: [] });
    groups.get(key)!.malls.push(m);
  }
  const order = (g: { city: Area | null }) => (g.city ? areas.indexOf(g.city) : Number.MAX_SAFE_INTEGER);
  return [...groups.values()]
    .sort((a, b) => order(a) - order(b))
    .map((g) => ({ ...g, malls: [...g.malls].sort((a, b) => a.name.localeCompare(b.name)) }));
}
