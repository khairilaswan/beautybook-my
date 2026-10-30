import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingAdminTools } from "@/app/admin/listings/[id]/tools";
import { type AdminListing, ListingForm } from "@/app/admin/listings/listing-form";
import { HoursEditor, PhotoManager, ServicesEditor } from "@/app/owner/[id]/editors";
import { requirePermission } from "@/lib/auth";
import { getAreas, getAttributes, getCategories } from "@/lib/data/directory";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";

// Auth runs inside Suspense so client navigations between admin pages stream
// instead of blocking.
export default function Page(props: PageProps<"/admin/listings/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <EditListingPage {...props} />
    </Suspense>
  );
}

async function EditListingPage({ params, searchParams }: PageProps<"/admin/listings/[id]">) {
  await requirePermission("listings.edit");
  const { id } = await params;
  const { created } = await searchParams;
  const supabase = await createClient();
  const [{ data }, areas, categories, attributes, services, hours, closures, photos, requests, members] = await Promise.all([
    supabase
      .from("listings")
      .select(
        `id, name, slug, status, address, postcode, lat, lng, phone, whatsapp, website, instagram, facebook,
         description, price_level, gender, google_place_id, source, last_verified_at, phone_verified_at, created_at,
         areas ( slug ), listing_categories ( is_primary, categories ( slug ) ), listing_attributes ( attribute_id )`,
      )
      .eq("id", id)
      .maybeSingle(),
    getAreas(),
    getCategories(),
    getAttributes(),
    supabase.from("services").select("name, price_from, price_to, duration_min").eq("listing_id", id).order("sort_order"),
    supabase.from("opening_hours").select("weekday, opens, closes").eq("listing_id", id),
    supabase.from("closures").select("date_from, date_to, note").eq("listing_id", id),
    supabase.from("photos").select("id, storage_path, status").eq("listing_id", id).order("sort_order"),
    supabase.from("booking_requests").select("id", { count: "exact", head: true }).eq("listing_id", id),
    supabase.from("listing_members").select("user_id, role").eq("listing_id", id),
  ]);
  if (!data) notFound();
  type Row = Omit<typeof data, "areas" | "listing_categories" | "listing_attributes"> & {
    areas: { slug: string } | null;
    listing_categories: { is_primary: boolean; categories: { slug: string } }[];
    listing_attributes: { attribute_id: number }[];
  };
  const row = data as unknown as Row;
  const listing: AdminListing = {
    ...row,
    area_slug: row.areas?.slug ?? null,
    category_slugs: row.listing_categories.map((c) => c.categories.slug),
    primary_category: row.listing_categories.find((c) => c.is_primary)?.categories.slug ?? null,
    attribute_ids: row.listing_attributes.map((a) => a.attribute_id),
  };

  return (
    <div className="space-y-8">
      {created && <p className="rounded-xl bg-green-50 p-3 text-sm">Listing created.</p>}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{row.name}</h1>
          <p className="text-sm text-muted">
            {row.status === "active" && <><Link href={`/shop/${row.slug}`} className="underline">View page</Link> · </>}
            Source: {row.source} · Added {formatDate(row.created_at)} · Last checked{" "}
            {row.last_verified_at ? formatDate(row.last_verified_at) : "never"} · Phone{" "}
            {row.phone_verified_at ? "verified by owner" : "not verified"} · {requests.count ?? 0} requests ·{" "}
            {members.data?.length ? "Claimed" : "Unclaimed"}
          </p>
        </div>
        <ListingAdminTools id={row.id} status={row.status} />
      </div>
      <ListingForm listing={listing} areas={areas} categories={categories} attributes={attributes} />
      <section>
        <h2 className="text-lg font-semibold">Service menu</h2>
        <ServicesEditor listingId={row.id} slug={row.slug} initial={services.data ?? []} />
      </section>
      <section>
        <h2 className="text-lg font-semibold">Opening hours</h2>
        <HoursEditor listingId={row.id} slug={row.slug} initialHours={hours.data ?? []} initialClosures={closures.data ?? []} />
      </section>
      <section>
        <h2 className="text-lg font-semibold">Photos</h2>
        <PhotoManager listingId={row.id} slug={row.slug} photos={photos.data ?? []} />
      </section>
    </div>
  );
}
