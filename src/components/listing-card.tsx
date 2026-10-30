import Image from "next/image";
import Link from "next/link";
import { GENDER_LABELS, photoUrl, priceLevelLabel } from "@/lib/format";
import type { Category, ListingCard as Card } from "@/lib/types";

export function ListingCard({ listing, categories }: { listing: Card; categories: Category[] }) {
  const category = categories.find((c) => c.slug === listing.primary_category);
  return (
    <Link
      href={`/shop/${listing.slug}`}
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
            Open now
          </span>
        )}
      </div>
      <div className="space-y-1 p-4">
        <h3 className="font-semibold leading-snug group-hover:text-brand-700">{listing.name}</h3>
        <p className="text-sm text-muted">
          {[category?.name_en, listing.area_name].filter(Boolean).join(" · ")}
        </p>
        <p className="flex flex-wrap gap-2 text-xs text-muted">
          {listing.gender && <span>{GENDER_LABELS[listing.gender]}</span>}
          {listing.price_level && <span>{priceLevelLabel(listing.price_level)}</span>}
          {listing.is_claimed && <span className="text-brand-700">Owner-managed</span>}
        </p>
      </div>
    </Link>
  );
}

export function ListingGrid({ listings, categories }: { listings: Card[]; categories: Category[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {listings.map((l) => (
        <ListingCard key={l.id} listing={l} categories={categories} />
      ))}
    </div>
  );
}
