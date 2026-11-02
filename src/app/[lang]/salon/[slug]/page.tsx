import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { BookingForm } from "@/components/booking-form";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { OpenStatus } from "@/components/open-status";
import { ShopUserTools } from "@/components/shop-user-tools";
import { getListing, getRedirect } from "@/lib/data/directory";
import { getShopTheme, getSiteSettings } from "@/lib/data/site-theme";
import { formatDate, photoUrl, priceLabel, priceLevelLabel } from "@/lib/format";
import { weeklySchedule } from "@/lib/hours";
import { alternatesFor, fmt } from "@/lib/i18n/config";
import { areaName, attributeName, categoryName, serviceName } from "@/lib/i18n/names";
import { getI18n } from "@/lib/i18n/server";
import { hubPath, listingPath } from "@/lib/paths";
import { formatMalaysianPhone } from "@/lib/phone";
import { breadcrumbJsonLd, listingJsonLd } from "@/lib/seo";
import type { ListingDetail } from "@/lib/types";

async function loadListing(slug: string, href: (path: string) => string): Promise<ListingDetail> {
  const listing = await getListing(slug);
  if (listing) return listing;
  const to = await getRedirect(listingPath(slug));
  if (to) permanentRedirect(href(to));
  notFound();
}

export async function generateMetadata({ params }: PageProps<"/[lang]/salon/[slug]">): Promise<Metadata> {
  const [{ slug }, { locale, t }] = await Promise.all([params, getI18n()]);
  const listing = await getListing(slug);
  if (!listing) return { title: t.shop.notFound, robots: { index: false } };
  const category = listing.categories[0];
  const where = listing.area ? areaName(listing.area, locale) : t.common.klangValley;
  const catName = category ? categoryName(category, locale) : null;
  const title = fmt(t.shop.metaTitle, { name: listing.name, category: catName ?? t.shop.beauty, area: where });
  // The shop's own description is in whatever language the owner wrote it.
  const description =
    listing.description?.slice(0, 155) ??
    fmt(t.shop.metaDescription, {
      name: listing.name,
      category: catName?.toLowerCase() ?? t.shop.beautyShop,
      area: where,
    });
  const cover = listing.photos[0];
  const alternates = alternatesFor(locale, listingPath(listing.slug));
  return {
    title,
    description,
    alternates,
    openGraph: {
      title,
      description,
      url: alternates.canonical,
      images: cover ? [{ url: photoUrl(cover.storage_path) }] : undefined,
    },
    robots: listing.status === "active" ? undefined : { index: false },
  };
}

export default function ShopPage({ params }: PageProps<"/[lang]/salon/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-6xl animate-pulse px-4 py-8" />}>
      <Shop params={params} />
    </Suspense>
  );
}

async function Shop({ params }: { params: PageProps<"/[lang]/salon/[slug]">["params"] }) {
  const [{ slug }, { locale, t, href }] = await Promise.all([params, getI18n()]);
  const [listing, { ownerThemes }] = await Promise.all([loadListing(slug, href), getSiteSettings()]);
  const shopTheme = ownerThemes ? await getShopTheme(listing.slug) : null;
  const category = listing.categories[0];
  const crumbs = [
    { name: t.nav.home, path: href("/") },
    ...listing.area_path
      .filter((a) => a.type !== "state")
      .map((a) => ({ name: areaName(a, locale), path: href(hubPath(a.slug)) })),
    ...(category && listing.area
      ? [{ name: categoryName(category, locale), path: href(hubPath(listing.area.slug, category.slug)) }]
      : []),
    { name: listing.name, path: href(listingPath(listing.slug)) },
  ];
  const waNumber = listing.whatsapp ?? (listing.phone?.startsWith("601") ? listing.phone : null);
  const isOpenForRequests = listing.status === "active" && !!waNumber;
  const schedule = weeklySchedule(listing.hours, locale);
  const mapsQuery =
    listing.lat !== null && listing.lng !== null
      ? `${listing.lat},${listing.lng}`
      : [listing.name, listing.address].filter(Boolean).join(", ");

  const page = (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <JsonLd data={[listingJsonLd(listing), breadcrumbJsonLd(crumbs)]} />
      <Breadcrumbs items={crumbs} />

      {listing.status === "closed" && (
        <p className="mt-4 rounded-xl bg-canvas p-3 text-sm font-medium">{t.shop.closedPermanently}</p>
      )}

      <div className="mt-4 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{listing.name}</h1>
          <p className="mt-1 text-muted">
            {[
              listing.categories.map((c) => categoryName(c, locale)).join(", "),
              listing.area && areaName(listing.area, locale),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <OpenStatus hours={listing.hours} closures={listing.closures} />
            {listing.gender && <span className="rounded-full bg-white px-2.5 py-0.5">{t.common.gender[listing.gender]}</span>}
            {listing.price_level && <span className="rounded-full bg-white px-2.5 py-0.5">{priceLevelLabel(listing.price_level)}</span>}
            {listing.is_claimed ? (
              <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-brand-700">{t.shop.managedByOwner}</span>
            ) : null}
          </div>
        </div>
        <Suspense>
          <ShopUserTools listingId={listing.id} slug={listing.slug} />
        </Suspense>
      </div>

      {listing.photos.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {listing.photos.slice(0, 5).map((p, i) => (
            <div
              key={p.id}
              className={`relative overflow-hidden rounded-2xl bg-brand-50 ${i === 0 ? "col-span-2 row-span-2 aspect-square" : "aspect-square"}`}
            >
              <Image
                src={photoUrl(p.storage_path)}
                alt={p.alt ?? fmt(t.shop.photoAlt, { name: listing.name, n: i + 1 })}
                fill
                priority={i === 0}
                sizes={i === 0 ? "(min-width: 640px) 50vw, 100vw" : "25vw"}
                className="object-cover"
              />
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-10">
          {listing.description && (
            <section>
              <h2 className="text-xl font-semibold">{t.shop.about}</h2>
              <p className="mt-2 whitespace-pre-line">{listing.description}</p>
            </section>
          )}

          <section>
            <h2 className="text-xl font-semibold">{t.shop.services}</h2>
            {listing.services.length === 0 ? (
              <p className="mt-2 text-muted">{t.shop.askMenu}</p>
            ) : (
              <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">
                {listing.services.map((s) => (
                  <li key={s.id} className="flex items-baseline justify-between gap-4 p-4">
                    <span>
                      {serviceName(s, locale)}
                      {s.duration_min && (
                        <span className="ml-2 text-sm text-muted">{fmt(t.common.minutes, { count: s.duration_min })}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-sm font-medium">{priceLabel(s, locale) ?? t.common.askForPrice}</span>
                  </li>
                ))}
              </ul>
            )}
            {listing.services_are_template && (
              <p className="mt-2 text-sm text-muted">{t.shop.templateNote}</p>
            )}
          </section>

          {listing.attributes.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold">{t.shop.goodToKnow}</h2>
              <ul className="mt-3 flex flex-wrap gap-2 text-sm">
                {listing.attributes.map((a) => (
                  <li key={a.slug} className="rounded-full border border-line bg-white px-3 py-1">{attributeName(a, locale)}</li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="text-xl font-semibold">{t.shop.openingHours}</h2>
            {listing.hours.length === 0 ? (
              <p className="mt-2 text-muted">{t.shop.noHours}</p>
            ) : (
              <table className="mt-3 w-full max-w-md text-sm">
                <tbody>
                  {schedule.map((d) => (
                    <tr key={d.weekday} className="border-b border-line last:border-0">
                      <th scope="row" className="py-2 text-left font-medium">{d.label}</th>
                      <td className="py-2 text-right">{d.slots.length ? d.slots.join(", ") : t.common.closed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {listing.closures.length > 0 && (
              <ul className="mt-3 text-sm text-muted">
                {listing.closures.map((c) => (
                  <li key={c.date_from}>
                    {fmt(t.shop.closedOn, { from: formatDate(c.date_from, locale) })}
                    {c.date_to !== c.date_from ? fmt(t.shop.closedTo, { to: formatDate(c.date_to, locale) }) : ""}
                    {c.note ? ` (${c.note})` : ""}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-xl font-semibold">{t.shop.location}</h2>
            {listing.address && <p className="mt-2">{[listing.address, listing.postcode].filter(Boolean).join(" ")}</p>}
            {listing.lat !== null && listing.lng !== null && (
              <iframe
                title={fmt(t.shop.mapOf, { name: listing.name })}
                className="mt-3 h-64 w-full rounded-2xl border border-line"
                loading="lazy"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${listing.lng - 0.004}%2C${listing.lat - 0.003}%2C${listing.lng + 0.004}%2C${listing.lat + 0.003}&layer=mapnik&marker=${listing.lat}%2C${listing.lng}`}
              />
            )}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm underline"
            >
              {t.shop.directions}
            </a>
          </section>

          <p className="text-sm text-muted">
            {listing.last_verified_at && <>{fmt(t.shop.lastChecked, { date: formatDate(listing.last_verified_at, locale) })} </>}
            <Link href={href(`${listingPath(listing.slug)}/report`)} className="underline">{t.shop.report}</Link>
          </p>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {isOpenForRequests ? (
            <div id="book" className="scroll-mt-20 rounded-2xl border border-line bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">{t.shop.requestBooking}</h2>
              <div className="mt-3">
                <BookingForm listingId={listing.id} services={listing.services} hours={listing.hours} />
              </div>
            </div>
          ) : null}
          {listing.phone && listing.status === "active" && (
            <a
              href={`tel:+${listing.phone}`}
              className="flex w-full items-center justify-center rounded-xl border border-ink px-4 py-3 font-semibold hover:bg-white"
            >
              {fmt(t.shop.call, { phone: formatMalaysianPhone(listing.phone) })}
            </a>
          )}
          <div className="flex flex-wrap gap-3 text-sm">
            {listing.instagram && <a href={listing.instagram} target="_blank" rel="noopener noreferrer nofollow" className="underline">Instagram</a>}
            {listing.facebook && <a href={listing.facebook} target="_blank" rel="noopener noreferrer nofollow" className="underline">Facebook</a>}
            {listing.website && <a href={listing.website} target="_blank" rel="noopener noreferrer nofollow" className="underline">{t.shop.website}</a>}
          </div>
          {!listing.is_claimed && listing.status === "active" && (
            <div className="rounded-2xl bg-ink p-5 text-white">
              <p className="font-semibold">{t.shop.yourBusiness}</p>
              <p className="mt-1 text-sm text-white/75">{t.shop.claimPitch}</p>
              <Link
                href={href(`/claim/${listing.slug}`)}
                className="mt-3 inline-block rounded-full bg-white px-4 py-2 text-sm font-medium text-ink"
              >
                {t.shop.claimCta}
              </Link>
            </div>
          )}
        </aside>
      </div>

      {isOpenForRequests && (
        <a
          href="#book"
          className="fixed inset-x-4 bottom-4 z-20 rounded-xl bg-whatsapp px-4 py-3 text-center font-semibold text-white shadow-lg lg:hidden"
        >
          {t.shop.bookWhatsApp}
        </a>
      )}
    </div>
  );
  // The owner's own theme covers the page between the site header and footer.
  return shopTheme ? (
    <div data-style={shopTheme.style} data-color={shopTheme.color}>
      {page}
    </div>
  ) : (
    page
  );
}
