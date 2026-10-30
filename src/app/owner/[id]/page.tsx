import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DetailsForm, HoursEditor, PhotoManager, ServicesEditor } from "@/app/owner/[id]/editors";
import { RequestStatusButtons } from "@/components/request-status-buttons";
import { requireUser } from "@/lib/auth";
import { getAttributes } from "@/lib/data/directory";
import { daysAgoIso, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Manage your listing", robots: { index: false } };

const STATUS_LABELS: Record<string, string> = {
  sent: "New",
  confirmed: "Confirmed",
  declined: "Declined",
  no_show: "No-show",
  completed: "Completed",
};

export default function OwnerListingPage({ params, searchParams }: PageProps<"/owner/[id]">) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Dashboard params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Dashboard({
  params,
  searchParams,
}: {
  params: PageProps<"/owner/[id]">["params"];
  searchParams: PageProps<"/owner/[id]">["searchParams"];
}) {
  const { id } = await params;
  const { welcome } = await searchParams;
  const user = await requireUser(`/owner/${id}`);
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("listing_members")
    .select("role")
    .eq("listing_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) notFound();

  const monthAgo = daysAgoIso(30);
  const [listing, requests, monthCount, services, hours, closures, photos, attrs, allAttributes] = await Promise.all([
    supabase
      .from("listings")
      .select("id, slug, name, status, phone, description, website, instagram, facebook, price_level, gender")
      .eq("id", id)
      .single(),
    supabase
      .from("booking_requests")
      .select("id, short_code, service_name, preferred_at, customer_name, customer_phone, note, status, created_at")
      .eq("listing_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.rpc("listing_enquiry_count", { p_listing_id: id, p_since: monthAgo }),
    supabase.from("services").select("name, price_from, price_to, duration_min").eq("listing_id", id).order("sort_order"),
    supabase.from("opening_hours").select("weekday, opens, closes").eq("listing_id", id),
    supabase.from("closures").select("date_from, date_to, note").eq("listing_id", id).order("date_from"),
    supabase.from("photos").select("id, storage_path, status").eq("listing_id", id).order("sort_order"),
    supabase.from("listing_attributes").select("attribute_id").eq("listing_id", id),
    getAttributes(),
  ]);
  if (!listing.data) notFound();
  const l = listing.data;

  return (
    <div className="space-y-10">
      {welcome && (
        <p className="rounded-2xl bg-green-50 p-4 text-sm">
          You now manage <strong>{l.name}</strong> on BeautyBook. Add your menu and hours so customers can book.
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{l.name}</h1>
          <p className="text-sm text-muted">
            {l.status === "active" ? (
              <Link href={`/shop/${l.slug}`} className="underline">View public page</Link>
            ) : (
              <>Not public yet ({l.status})</>
            )}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-white px-5 py-3 text-right">
          <p className="text-2xl font-bold">{Number(monthCount.data ?? 0)}</p>
          <p className="text-xs text-muted">enquiries in the last 30 days</p>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold">Booking requests</h2>
        {requests.data?.length ? (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">
            {requests.data.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium">
                    {r.customer_name} · {r.service_name}
                  </p>
                  <p className="text-sm text-muted">
                    {r.preferred_at ? `Wants ${formatDate(r.preferred_at)}` : "Any time"} · sent {formatDate(r.created_at)} ·{" "}
                    {STATUS_LABELS[r.status]}
                  </p>
                  {r.note && <p className="text-sm">“{r.note}”</p>}
                </div>
                <RequestStatusButtons id={r.id} status={r.status} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-muted">No requests yet. They appear here as soon as a customer sends one.</p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Details</h2>
        <DetailsForm
          listing={l}
          attributes={allAttributes}
          selectedAttributes={(attrs.data ?? []).map((a) => a.attribute_id)}
        />
        <p className="mt-2 text-sm text-muted">
          To change the shop name, address or phone number, <Link href={`/shop/${l.slug}/report`} className="underline">send us a correction</Link>.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Service menu</h2>
        <ServicesEditor listingId={l.id} slug={l.slug} initial={services.data ?? []} />
      </section>

      <section>
        <h2 className="text-lg font-semibold">Opening hours</h2>
        <HoursEditor listingId={l.id} slug={l.slug} initialHours={hours.data ?? []} initialClosures={closures.data ?? []} />
      </section>

      <section>
        <h2 className="text-lg font-semibold">Photos</h2>
        <PhotoManager listingId={l.id} slug={l.slug} photos={photos.data ?? []} />
      </section>
    </div>
  );
}
