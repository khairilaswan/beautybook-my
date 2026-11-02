import { listingPath } from "@/lib/paths";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ClaimForms } from "@/app/[lang]/claim/[slug]/claim-forms";
import { requireUser } from "@/lib/auth";
import { fmt } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { maskPhone } from "@/lib/phone";
import { whatsAppCodesEnabled } from "@/lib/whatsapp-cloud";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.claim.metaTitle, robots: { index: false } };
}

export default async function ClaimPage({ params, searchParams }: PageProps<"/[lang]/claim/[slug]">) {
  const { t } = await getI18n();
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
        <Claim params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Claim({
  params,
  searchParams,
}: {
  params: PageProps<"/[lang]/claim/[slug]">["params"];
  searchParams: PageProps<"/[lang]/claim/[slug]">["searchParams"];
}) {
  const { slug } = await params;
  const { existing } = await searchParams;
  const [user, { t, href }] = await Promise.all([requireUser(`/claim/${slug}`), getI18n()]);

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
        <Link href={href(listingPath(listing.slug))} className="underline">{listing.name}</Link>
      </p>
      <h1 className="mt-1 text-2xl font-bold">{t.claim.title}</h1>
      {existing && <p className="mt-3 rounded-xl bg-brand-50 p-3 text-sm">{fmt(t.claim.existing, { name: listing.name })}</p>}
      <p className="mt-3 text-muted">{(count ?? 0) > 0 ? t.claim.managed : t.claim.free}</p>
      <div className="mt-8">
        <ClaimForms
          listingId={listing.id}
          slug={listing.slug}
          userId={user.id}
          maskedPhone={mobile ? maskPhone(mobile) : null}
          canUseCode={whatsAppCodesEnabled() && !!mobile && (count ?? 0) === 0}
        />
      </div>
    </>
  );
}
