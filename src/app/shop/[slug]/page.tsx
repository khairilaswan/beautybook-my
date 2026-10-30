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
import { GENDER_LABELS, formatDate, photoUrl, priceLabel, priceLevelLabel } from "@/lib/format";
import { weeklySchedule } from "@/lib/hours";
import { formatMalaysianPhone } from "@/lib/phone";
import { breadcrumbJsonLd, listingJsonLd } from "@/lib/seo";
import type { ListingDetail } from "@/lib/types";

async function loadListing(slug: string): Promise<ListingDetail> {
  const listing = await getListing(slug);
  if (listing) return listing;
  const to = await getRedirect(`/shop/${slug}`);
  if (to) permanentRedirect(to);
  notFound();
}

export async function generateMetadata({ params }: PageProps<"/shop/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getListing(slug);
  if (!listing) return { title: "Shop not found", robots: { index: false } };
  const category = listing.categories[0];
  const where = listing.area?.name ?? "Klang Valley";
  const title = `${listing.name}, ${category?.name_en ?? "beauty"} in ${where}`;
  const description =
    listing.description?.slice(0, 155) ??
    `${listing.name} is a ${category?.name_en.toLowerCase() ?? "beauty shop"} in ${where}. See services, prices and opening hours, then book on WhatsApp.`;
  const cover = listing.photos[0];
  return {
    title,
    description,
    alternates: { canonical: `/shop/${listing.slug}` },
    openGraph: {
      title,
      description,
      url: `/shop/${listing.slug}`,
      images: cover ? [{ url: photoUrl(cover.storage_path) }] : undefined,
    },
    robots: listing.status === "active" ? undefined : { index: false },
  };
}

export default function ShopPage({ params }: PageProps<"/shop/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-6xl animate-pulse px-4 py-8" />}>
      <Shop params={params} />
    </Suspense>
  );
}

async function Shop({ params }: { params: PageProps<"/shop/[slug]">["params"] }) {
  const { slug } = await params;
  const listing = await loadListing(slug);
  const category = listing.categories[0];
  const crumbs = [
    { name: "Home", path: "/" },
    ...listing.area_path.filter((a) => a.type !== "state").map((a) => ({ name: a.name, path: `/${a.slug}` })),
    ...(category && listing.area ? [{ name: category.name_en, path: `/${listing.area.slug}/${category.slug}` }] : []),
    { name: listing.name, path: `/shop/${listing.slug}` },
  ];
  const waNumber = listing.whatsapp ?? (listing.phone?.startsWith("601") ? listing.phone : null);
  const isOpenForRequests = listing.status === "active" && !!waNumber;
  const schedule = weeklySchedule(listing.hours);
  const mapsQuery =
    listing.lat !== null && listing.lng !== null
      ? `${listing.lat},${listing.lng}`
      : [listing.name, listing.address].filter(Boolean).join(", ");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <JsonLd data={[listingJsonLd(listing), breadcrumbJsonLd(crumbs)]} />
      <Breadcrumbs items={crumbs} />

      {listing.status === "closed" && (
        <p className="mt-4 rounded-xl bg-canvas p-3 text-sm font-medium">This shop has closed permanently.</p>
      )}

      <div className="mt-4 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{listing.name}</h1>
          <p className="mt-1 text-muted">
            {[listing.categories.map((c) => c.name_en).join(", "), listing.area?.name].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <OpenStatus hours={listing.hours} closures={listing.closures} />
            {listing.gender && <span className="rounded-full bg-white px-2.5 py-0.5">{GENDER_LABELS[listing.gender]}</span>}
            {listing.price_level && <span className="rounded-full bg-white px-2.5 py-0.5">{priceLevelLabel(listing.price_level)}</span>}
            {listing.is_claimed ? (
              <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-brand-700">Managed by the owner</span>
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
                alt={p.alt ?? `${listing.name} photo ${i + 1}`}
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
              <h2 className="text-xl font-semibold">About</h2>
              <p className="mt-2 whitespace-pre-line">{listing.description}</p>
            </section>
          )}

          <section>
            <h2 className="text-xl font-semibold">Services</h2>
            {listing.services.length === 0 ? (
              <p className="mt-2 text-muted">Ask the shop for their menu.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">
                {listing.services.map((s) => (
                  <li key={s.id} className="flex items-baseline justify-between gap-4 p-4">
                    <span>
                      {s.name}
                      {s.duration_min && <span className="ml-2 text-sm text-muted">{s.duration_min} min</span>}
                    </span>
                    <span className="shrink-0 text-sm font-medium">{priceLabel(s) ?? "Ask for price"}</span>
                  </li>
                ))}
              </ul>
            )}
            {listing.services_are_template && (
              <p className="mt-2 text-sm text-muted">
                Typical services for this kind of shop. The owner hasn&apos;t added their own menu yet.
              </p>
            )}
          </section>

          {listing.attributes.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold">Good to know</h2>
              <ul className="mt-3 flex flex-wrap gap-2 text-sm">
                {listing.attributes.map((a) => (
                  <li key={a.slug} className="rounded-full border border-line bg-white px-3 py-1">{a.name_en}</li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="text-xl font-semibold">Opening hours</h2>
            {listing.hours.length === 0 ? (
              <p className="mt-2 text-muted">Hours not listed yet. Message the shop to check.</p>
            ) : (
              <table className="mt-3 w-full max-w-md text-sm">
                <tbody>
                  {schedule.map((d) => (
                    <tr key={d.weekday} className="border-b border-line last:border-0">
                      <th scope="row" className="py-2 text-left font-medium">{d.label}</th>
                      <td className="py-2 text-right">{d.slots.length ? d.slots.join(", ") : "Closed"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {listing.closures.length > 0 && (
              <ul className="mt-3 text-sm text-muted">
                {listing.closures.map((c) => (
                  <li key={c.date_from}>
                    Closed {formatDate(c.date_from)}
                    {c.date_to !== c.date_from ? ` to ${formatDate(c.date_to)}` : ""}
                    {c.note ? ` (${c.note})` : ""}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-xl font-semibold">Location</h2>
            {listing.address && <p className="mt-2">{[listing.address, listing.postcode].filter(Boolean).join(" ")}</p>}
            {listing.lat !== null && listing.lng !== null && (
              <iframe
                title={`Map of ${listing.name}`}
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
              Get directions
            </a>
          </section>

          <p className="text-sm text-muted">
            {listing.last_verified_at && <>Details last checked {formatDate(listing.last_verified_at)}. </>}
            <Link href={`/shop/${listing.slug}/report`} className="underline">Report a problem</Link>
          </p>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {isOpenForRequests ? (
            <div id="book" className="scroll-mt-20 rounded-2xl border border-line bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Request a booking</h2>
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
              Call {formatMalaysianPhone(listing.phone)}
            </a>
          )}
          <div className="flex flex-wrap gap-3 text-sm">
            {listing.instagram && <a href={listing.instagram} target="_blank" rel="noopener noreferrer nofollow" className="underline">Instagram</a>}
            {listing.facebook && <a href={listing.facebook} target="_blank" rel="noopener noreferrer nofollow" className="underline">Facebook</a>}
            {listing.website && <a href={listing.website} target="_blank" rel="noopener noreferrer nofollow" className="underline">Website</a>}
          </div>
          {!listing.is_claimed && listing.status === "active" && (
            <div className="rounded-2xl bg-ink p-5 text-white">
              <p className="font-semibold">Is this your business?</p>
              <p className="mt-1 text-sm text-white/75">
                Claim it free to update your menu, hours and photos, and see every request.
              </p>
              <Link
                href={`/claim/${listing.slug}`}
                className="mt-3 inline-block rounded-full bg-white px-4 py-2 text-sm font-medium text-ink"
              >
                Claim this business
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
          Book on WhatsApp
        </a>
      )}
    </div>
  );
}
