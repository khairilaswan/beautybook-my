import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RequestStatusButtons } from "@/components/request-status-buttons";
import { getCurrentUser } from "@/lib/auth";
import { formatTime } from "@/lib/hours";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Booking request", robots: { index: false } };

const STATUS_LABELS: Record<string, string> = {
  sent: "Waiting for the shop",
  confirmed: "Confirmed",
  declined: "Declined",
  no_show: "No-show",
  completed: "Completed",
};

// The link at the end of every WhatsApp booking request. The shop owner opens
// it to confirm; an unclaimed shop is invited to claim its listing.
export default function RequestPage({ params }: PageProps<"/r/[code]">) {
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Request params={params} />
      </Suspense>
    </div>
  );
}

async function Request({ params }: { params: PageProps<"/r/[code]">["params"] }) {
  const { code } = await params;
  if (!/^[A-Za-z0-9]{6,10}$/.test(code)) notFound();
  const admin = createAdminClient();
  const { data: request } = await admin
    .from("booking_requests")
    .select("id, listing_id, service_name, preferred_at, customer_name, status, created_at, listings ( slug, name )")
    .eq("short_code", code)
    .maybeSingle();
  if (!request) notFound();
  const listing = (request as unknown as { listings: { slug: string; name: string } }).listings;

  const [user, members] = await Promise.all([
    getCurrentUser(),
    admin.from("listing_members").select("user_id").eq("listing_id", request.listing_id),
  ]);
  const memberIds = (members.data ?? []).map((m) => m.user_id);
  const isMember = !!user && memberIds.includes(user.id);
  const preferred = request.preferred_at
    ? `${new Intl.DateTimeFormat("en-MY", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kuala_Lumpur" }).format(new Date(request.preferred_at))}, ${formatTime(
        new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Kuala_Lumpur" }).format(new Date(request.preferred_at)),
      )}`
    : "Any time";

  return (
    <>
      <p className="text-sm text-muted">Booking request for</p>
      <h1 className="text-2xl font-bold">{listing.name}</h1>
      <dl className="mt-6 divide-y divide-line rounded-2xl border border-line bg-white text-sm">
        <Row label="Customer" value={request.customer_name} />
        <Row label="Service" value={request.service_name} />
        <Row label="Preferred time" value={preferred} />
        <Row label="Status" value={STATUS_LABELS[request.status] ?? request.status} />
      </dl>

      <div className="mt-6">
        {isMember ? (
          <div className="space-y-3">
            <RequestStatusButtons id={request.id} status={request.status} />
            <Link href={`/owner/${request.listing_id}`} className="block text-sm underline">Open your dashboard</Link>
          </div>
        ) : memberIds.length === 0 ? (
          <div className="rounded-2xl bg-ink p-5 text-white">
            <p className="font-semibold">Is this your shop?</p>
            <p className="mt-1 text-sm text-white/75">
              Claim your free BeautyBook listing to confirm requests like this one, update your prices and see every
              enquiry. It takes about a minute.
            </p>
            <Link href={`/claim/${listing.slug}`} className="mt-3 inline-block rounded-full bg-white px-4 py-2 text-sm font-medium text-ink">
              Claim {listing.name}
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted">
            Shop owner? <Link href={`/login?next=/r/${code}`} className="underline">Sign in</Link> to confirm this request.
          </p>
        )}
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 p-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
