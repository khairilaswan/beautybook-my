export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

// "Classic Barber" in Bangsar -> classic-barber-bangsar
export function listingSlug(name: string, areaSlug: string | null): string {
  const base = slugify(name) || "shop";
  if (!areaSlug || base.endsWith(areaSlug)) return base;
  return `${base}-${areaSlug}`;
}

// Picks the first free slug: base, base-2, base-3, ...
export async function uniqueSlug(base: string, taken: (slugs: string[]) => Promise<string[]>): Promise<string> {
  const candidates = [base, ...Array.from({ length: 20 }, (_, i) => `${base}-${i + 2}`)];
  const used = new Set(await taken(candidates));
  const free = candidates.find((c) => !used.has(c));
  return free ?? `${base}-${Date.now().toString(36)}`;
}
