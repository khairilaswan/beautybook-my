import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GiftForm } from "@/app/[lang]/salon/[slug]/gift/gift-form";
import { getCurrentUser } from "@/lib/auth";
import { getListing } from "@/lib/data/directory";
import { fmt } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { listingPath } from "@/lib/paths";
import { paymentsEnabled } from "@/lib/setup";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.growth.gift.title, robots: { index: false } };
}

export default async function GiftPage({ params }: PageProps<"/[lang]/salon/[slug]/gift">) {
  const { t } = await getI18n();
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
        <Gift params={params} />
      </Suspense>
    </div>
  );
}

async function Gift({ params }: { params: PageProps<"/[lang]/salon/[slug]/gift">["params"] }) {
  const [{ slug }, { t, href }] = await Promise.all([params, getI18n()]);
  const g = t.growth.gift;
  const listing = await getListing(slug);
  if (!listing || listing.status !== "active" || !listing.vouchers || !paymentsEnabled()) notFound();
  const user = await getCurrentUser();
  return (
    <>
      <p className="text-sm">
        <Link href={href(listingPath(listing.slug))} className="underline">{listing.name}</Link>
      </p>
      <h1 className="mt-1 text-2xl font-bold">{g.title}</h1>
      <p className="mt-2 text-muted">
        {fmt(g.lead, { months: listing.vouchers.valid_months, shop: listing.name })}
      </p>
      {listing.vouchers.terms && <p className="mt-2 text-sm text-muted">{fmt(g.terms, { terms: listing.vouchers.terms })}</p>}
      {user ? (
        <GiftForm listingId={listing.id} amounts={listing.vouchers.amounts} buyerName={user.displayName ?? ""} />
      ) : (
        <Link
          href={href(`/login?next=${encodeURIComponent(href(`${listingPath(listing.slug)}/gift`))}`)}
          className="mt-6 inline-block rounded-full bg-ink px-5 py-2 text-white"
        >
          {g.signIn}
        </Link>
      )}
    </>
  );
}
