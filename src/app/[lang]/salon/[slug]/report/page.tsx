import { listingPath } from "@/lib/paths";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ReportForm } from "@/app/salon/[slug]/report/report-form";
import { getListing } from "@/lib/data/directory";

export const metadata: Metadata = { title: "Report a problem", robots: { index: false } };

export default function ReportPage({ params }: PageProps<"/salon/[slug]/report">) {
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Suspense>
        <Report params={params} />
      </Suspense>
    </div>
  );
}

async function Report({ params }: { params: PageProps<"/salon/[slug]/report">["params"] }) {
  const { slug } = await params;
  const listing = await getListing(slug);
  if (!listing) notFound();
  return (
    <>
      <p className="text-sm text-muted"><Link href={listingPath(slug)} className="underline">{listing.name}</Link></p>
      <h1 className="mt-1 text-2xl font-bold">Report a problem</h1>
      <p className="mt-2 text-muted">Tell us what&apos;s wrong and our team will check it.</p>
      <div className="mt-6">
        <ReportForm listingId={listing.id} />
      </div>
    </>
  );
}
