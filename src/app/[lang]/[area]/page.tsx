import { Suspense } from "react";
import { HubPage, HubSkeleton } from "@/components/hub-page";
import { hubMetadata } from "@/lib/hub-metadata";
import { getLocale } from "@/lib/i18n/server";

export async function generateMetadata({ params }: PageProps<"/[lang]/[area]">) {
  const { area } = await params;
  return hubMetadata(area, null, await getLocale());
}

export default function AreaPage({ params }: PageProps<"/[lang]/[area]">) {
  return (
    <Suspense fallback={<HubSkeleton />}>
      <AreaHub params={params} />
    </Suspense>
  );
}

async function AreaHub({ params }: { params: PageProps<"/[lang]/[area]">["params"] }) {
  const { area } = await params;
  return <HubPage areaSlug={area} categorySlug={null} />;
}
