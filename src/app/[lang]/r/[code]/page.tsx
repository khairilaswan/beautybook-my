import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RequestStatusButtons } from "@/components/request-status-buttons";
import { getCurrentUser } from "@/lib/auth";
import { fmt } from "@/lib/i18n/config";
import { localDate, localTime } from "@/lib/i18n/names";
import { getI18n } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.request.metaTitle, robots: { index: false } };
}

// The link at the end of every WhatsApp booking request. The shop owner opens
// it to confirm; an unclaimed shop is invited to claim its listing.
export default async function RequestPage({ params }: PageProps<"/[lang]/r/[code]">) {
  const { t } = await getI18n();
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
        <Request params={params} />
      </Suspense>
    </div>
  );
}

async function Request({ params }: { params: PageProps<"/[lang]/r/[code]">["params"] }) {
  const [{ code }, { locale, t, href }] = await Promise.all([params, getI18n()]);
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
    ? `${localDate(request.preferred_at, locale, { weekday: "long", day: "numeric", month: "long" })}, ${localTime(
        new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Kuala_Lumpur" }).format(new Date(request.preferred_at)),
        locale,
      )}`
    : t.request.anyTime;
  const statuses: Record<string, string> = t.request.statuses;

  return (
    <>
      <p className="text-sm text-muted">{t.request.for}</p>
      <h1 className="text-2xl font-bold">{listing.name}</h1>
      <dl className="mt-6 divide-y divide-line rounded-2xl border border-line bg-white text-sm">
        <Row label={t.request.customer} value={request.customer_name} />
        <Row label={t.request.service} value={request.service_name} />
        <Row label={t.request.preferred} value={preferred} />
        <Row label={t.request.status} value={statuses[request.status] ?? request.status} />
      </dl>

      <div className="mt-6">
        {isMember ? (
          <div className="space-y-3">
            <RequestStatusButtons id={request.id} status={request.status} />
            <Link href={href(`/owner/${request.listing_id}`)} className="block text-sm underline">{t.request.dashboard}</Link>
          </div>
        ) : memberIds.length === 0 ? (
          <div className="rounded-2xl bg-ink p-5 text-white">
            <p className="font-semibold">{t.request.yourShop}</p>
            <p className="mt-1 text-sm text-white/75">{t.request.claimPitch}</p>
            <Link href={href(`/claim/${listing.slug}`)} className="mt-3 inline-block rounded-full bg-white px-4 py-2 text-sm font-medium text-ink">
              {fmt(t.request.claim, { name: listing.name })}
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted">
            {t.request.ownerPrompt}{" "}
            <Link href={href(`/login?next=${encodeURIComponent(href(`/r/${code}`))}`)} className="underline">
              {t.request.signIn}
            </Link>{" "}
            {t.request.toConfirm}
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
