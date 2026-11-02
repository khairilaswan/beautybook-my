import { Suspense } from "react";
import { HubPage, HubSkeleton } from "@/components/hub-page";
import { hubMetadata } from "@/lib/hub-metadata";
import { getLocale } from "@/lib/i18n/server";

export async function generateMetadata({ params }: PageProps<"/[lang]/[area]/[category]">) {
  const { area, category } = await params;
  return hubMetadata(area, category, await getLocale());
}

export default function AreaCategoryPage({ params }: PageProps<"/[lang]/[area]/[category]">) {
  return (
    <Suspense fallback={<HubSkeleton />}>
      <AreaCategoryHub params={params} />
    </Suspense>
  );
}

async function AreaCategoryHub({ params }: { params: PageProps<"/[lang]/[area]/[category]">["params"] }) {
  const { area, category } = await params;
  return <HubPage areaSlug={area} categorySlug={category} />;
}
