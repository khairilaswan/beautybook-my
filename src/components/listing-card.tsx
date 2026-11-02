import Image from "next/image";
import Link from "next/link";
import { CompareButton } from "@/components/compare";
import { Silhouette } from "@/components/silhouette";
import { photoUrl, priceLevelLabel, priceRangeLabel } from "@/lib/format";
import { areaName, categoryName } from "@/lib/i18n/names";
import { type I18n, getI18n } from "@/lib/i18n/server";
import { listingPath } from "@/lib/paths";
import type { Category, ListingCard as Card } from "@/lib/types";

type CardOptions = { showRatings?: boolean };

export function ListingCard({
  listing,
  categories,
  showRatings = false,
  i18n,
}: { listing: Card; categories: Category[]; i18n: I18n } & CardOptions) {
  const { locale, t, href } = i18n;
  const category = categories.find((c) => c.slug === listing.primary_category);
  const area = listing.area_name && listing.area_slug ? areaName({ slug: listing.area_slug, name: listing.area_name }, locale) : listing.area_name;
  const price = priceRangeLabel(listing.min_price, listing.max_price, locale);
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-line bg-white transition hover:-translate-y-0.5 hover:shadow-md">
      <Link href={href(listingPath(listing.slug))} className="block">
        <div className="relative aspect-[4/3] bg-brand-50">
          {listing.cover_path ? (
            <Image
              src={photoUrl(listing.cover_path)}
              alt=""
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover"
            />
          ) : (
            <Silhouette className="p-6" />
          )}
          <div className="absolute left-3 top-3 flex flex-wrap gap-1">
            {listing.is_featured && (
              <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-medium text-white">{t.growth.card.featured}</span>
            )}
            {listing.open_now && (
              <span className="rounded-full bg-white/95 px-2 py-0.5 text-xs font-medium text-whatsapp">{t.common.openNow}</span>
            )}
            {listing.has_deal && (
              <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-medium text-white">{t.growth.card.deal}</span>
            )}
          </div>
        </div>
        <div className="space-y-1 p-4">
          <h3 className="font-semibold leading-snug group-hover:text-brand-700">{listing.name}</h3>
          <p className="text-sm text-muted">
            {[category && categoryName(category, locale), listing.mall_name ?? area, listing.distance_km !== null ? `${listing.distance_km} km` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="flex flex-wrap gap-2 text-xs text-muted">
            {showRatings && listing.rating_count > 0 && (
              <span className="font-medium text-ink">
                ★ {listing.rating_avg} ({listing.rating_count})
              </span>
            )}
            {price && <span className="font-medium text-ink">{price}</span>}
            {listing.gender && <span>{t.common.gender[listing.gender]}</span>}
            {!price && listing.price_level && <span>{priceLevelLabel(listing.price_level)}</span>}
            {listing.is_claimed && <span className="text-brand-700">{t.common.ownerManaged}</span>}
          </p>
        </div>
      </Link>
      <CompareButton slug={listing.slug} name={listing.name} className="absolute right-3 top-3" />
    </div>
  );
}

export async function ListingGrid({
  listings,
  categories,
  showRatings = false,
}: { listings: Card[]; categories: Category[] } & CardOptions) {
  const i18n = await getI18n();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {listings.map((l) => (
        <ListingCard key={l.id} listing={l} categories={categories} showRatings={showRatings} i18n={i18n} />
      ))}
    </div>
  );
}
