// Public URLs in one place, so a change of scheme is a one-line edit.
// Listings live at /salon/<slug>: "salon" matches what people search for,
// where "shop" in Malaysia reads as retail. Hubs stay flat because area slugs
// are unique: /bangsar and /bangsar/nail-salon.

export function listingPath(slug: string): string {
  return `/salon/${slug}`;
}

export function hubPath(areaSlug: string, categorySlug?: string | null): string {
  return categorySlug ? `/${areaSlug}/${categorySlug}` : `/${areaSlug}`;
}

// Mall landing pages: /mall/mid-valley-megamall. "mall" is a fixed segment,
// so no area may use the slug "mall".
export function mallPath(slug?: string | null): string {
  return slug ? `/mall/${slug}` : "/mall";
}
