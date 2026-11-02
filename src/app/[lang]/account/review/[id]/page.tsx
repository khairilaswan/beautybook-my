import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ReviewForm } from "@/app/[lang]/account/review/[id]/review-form";
import { requireUser } from "@/lib/auth";
import { getFeatureSettings } from "@/lib/data/features";
import { formatDate } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { listingPath } from "@/lib/paths";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.growth.review.title, robots: { index: false } };
}

export default async function ReviewPage({ params }: PageProps<"/[lang]/account/review/[id]">) {
  const { t } = await getI18n();
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
        <Review params={params} />
      </Suspense>
    </div>
  );
}

async function Review({ params }: { params: PageProps<"/[lang]/account/review/[id]">["params"] }) {
  const [{ id }, { locale, t, href }] = await Promise.all([params, getI18n()]);
  const user = await requireUser(`/account/review/${id}`);
  if (!(await getFeatureSettings()).reviewsEnabled) notFound();
  const supabase = await createClient();
  const { data: booking } = await supabase
    .from("booking_requests")
    .select("id, service_name, preferred_at, status, listings ( slug, name )")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!booking) notFound();
  const listing = (booking as unknown as { listings: { slug: string; name: string } }).listings;
  const { data: existing } = await supabase
    .from("reviews")
    .select("rating, body, author_name")
    .eq("booking_request_id", id)
    .maybeSingle();
  const firstName = (user.displayName ?? "").split(" ")[0];
  return (
    <>
      <h1 className="text-2xl font-bold">{t.growth.review.heading}</h1>
      <p className="mt-1 text-muted">
        <Link href={href(listingPath(listing.slug))} className="underline">{listing.name}</Link> · {booking.service_name}
        {booking.preferred_at ? ` · ${formatDate(booking.preferred_at, locale)}` : ""}
      </p>
      <ReviewForm
        bookingId={booking.id}
        initial={existing ?? { rating: 0, body: "", author_name: firstName ? `${firstName}` : "" }}
        shopHref={href(listingPath(listing.slug))}
      />
    </>
  );
}
