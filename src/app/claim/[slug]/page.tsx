import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ClaimForms } from "@/app/claim/[slug]/claim-forms";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { maskPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Claim your business", robots: { index: false } };

export default function ClaimPage({ params, searchParams }: PageProps<"/claim/[slug]">) {
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Claim params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Claim({
  params,
  searchParams,
}: {
  params: PageProps<"/claim/[slug]">["params"];
  searchParams: PageProps<"/claim/[slug]">["searchParams"];
}) {
  const { slug } = await params;
  const { existing } = await searchParams;
  const user = await requireUser(`/claim/${slug}`);

  // Read with the service role: a business someone just added is hidden
  // until its number is verified, and it still needs a claim page.
  const admin = createAdminClient();
  const { data: listing } = await admin
    .from("listings")
    .select("id, slug, name, status, phone, whatsapp")
    .eq("slug", slug)
    .maybeSingle();
  if (!listing || listing.status === "archived") notFound();
  const { count } = await admin
    .from("listing_members")
    .select("user_id", { count: "exact", head: true })
    .eq("listing_id", listing.id);
  const mobile = listing.whatsapp ?? (listing.phone?.startsWith("601") ? listing.phone : null);

  return (
    <>
      <p className="text-sm text-muted">
        <Link href={`/shop/${listing.slug}`} className="underline">{listing.name}</Link>
      </p>
      <h1 className="mt-1 text-2xl font-bold">Claim this business</h1>
      {existing && (
        <p className="mt-3 rounded-xl bg-brand-50 p-3 text-sm">
          This number is already on BeautyBook as {listing.name}. Claim it below instead of adding it again.
        </p>
      )}
      {(count ?? 0) > 0 ? (
        <p className="mt-3 text-muted">
          This business is already managed by its owner. If you are the owner and don&apos;t have access, send us
          proof below and we&apos;ll review it.
        </p>
      ) : (
        <p className="mt-3 text-muted">
          Claiming is free. You&apos;ll be able to update your menu, prices, hours and photos, and see every booking
          request.
        </p>
      )}
      <div className="mt-8">
        <ClaimForms
          listingId={listing.id}
          slug={listing.slug}
          userId={user.id}
          maskedPhone={mobile ? maskPhone(mobile) : null}
          canUseCode={!!mobile && (count ?? 0) === 0}
        />
      </div>
    </>
  );
}
