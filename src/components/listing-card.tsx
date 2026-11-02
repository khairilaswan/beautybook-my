import Image from "next/image";
import Link from "next/link";
import { photoUrl, priceLevelLabel } from "@/lib/format";
import { areaName, categoryName } from "@/lib/i18n/names";
import { type I18n, getI18n } from "@/lib/i18n/server";
import { listingPath } from "@/lib/paths";
import type { Category, ListingCard as Card } from "@/lib/types";

export function ListingCard({ listing, categories, i18n }: { listing: Card; categories: Category[]; i18n: I18n }) {
  const { locale, t, href } = i18n;
  const category = categories.find((c) => c.slug === listing.primary_category);
  const area = listing.area_name && listing.area_slug ? areaName({ slug: listing.area_slug, name: listing.area_name }, locale) : listing.area_name;
  return (
    <Link
      href={href(listingPath(listing.slug))}
      className="group overflow-hidden rounded-2xl border border-line bg-white transition hover:-translate-y-0.5 hover:shadow-md"
    >
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
          <div className="flex h-full items-center justify-center text-4xl font-bold text-brand-200">
            {listing.name.slice(0, 1)}
          </div>
        )}
        {listing.open_now && (
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2 py-0.5 text-xs font-medium text-whatsapp">
            {t.common.openNow}
          </span>
        )}
      </div>
      <div className="space-y-1 p-4">
        <h3 className="font-semibold leading-snug group-hover:text-brand-700">{listing.name}</h3>
        <p className="text-sm text-muted">
          {[category && categoryName(category, locale), area].filter(Boolean).join(" · ")}
        </p>
        <p className="flex flex-wrap gap-2 text-xs text-muted">
          {listing.gender && <span>{t.common.gender[listing.gender]}</span>}
          {listing.price_level && <span>{priceLevelLabel(listing.price_level)}</span>}
          {listing.is_claimed && <span className="text-brand-700">{t.common.ownerManaged}</span>}
        </p>
      </div>
    </Link>
  );
}

export async function ListingGrid({ listings, categories }: { listings: Card[]; categories: Category[] }) {
  const i18n = await getI18n();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {listings.map((l) => (
        <ListingCard key={l.id} listing={l} categories={categories} i18n={i18n} />
      ))}
    </div>
  );
}
