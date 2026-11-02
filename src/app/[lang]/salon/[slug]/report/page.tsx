import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ReportForm } from "@/app/[lang]/salon/[slug]/report/report-form";
import { getListing } from "@/lib/data/directory";
import { getI18n } from "@/lib/i18n/server";
import { listingPath } from "@/lib/paths";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.report.metaTitle, robots: { index: false } };
}

export default function ReportPage({ params }: PageProps<"/[lang]/salon/[slug]/report">) {
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Suspense>
        <Report params={params} />
      </Suspense>
    </div>
  );
}

async function Report({ params }: { params: PageProps<"/[lang]/salon/[slug]/report">["params"] }) {
  const [{ slug }, { t, href }] = await Promise.all([params, getI18n()]);
  const listing = await getListing(slug);
  if (!listing) notFound();
  return (
    <>
      <p className="text-sm text-muted"><Link href={href(listingPath(slug))} className="underline">{listing.name}</Link></p>
      <h1 className="mt-1 text-2xl font-bold">{t.report.title}</h1>
      <p className="mt-2 text-muted">{t.report.lead}</p>
      <div className="mt-6">
        <ReportForm listingId={listing.id} />
      </div>
    </>
  );
}
