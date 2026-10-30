import { Suspense } from "react";
import { HubPage, HubSkeleton } from "@/components/hub-page";
import { hubMetadata } from "@/lib/hub-metadata";

export async function generateMetadata({ params }: PageProps<"/[area]/[category]">) {
  const { area, category } = await params;
  return hubMetadata(area, category);
}

export default function AreaCategoryPage({ params }: PageProps<"/[area]/[category]">) {
  return (
    <Suspense fallback={<HubSkeleton />}>
      <AreaCategoryHub params={params} />
    </Suspense>
  );
}

async function AreaCategoryHub({ params }: { params: PageProps<"/[area]/[category]">["params"] }) {
  const { area, category } = await params;
  return <HubPage areaSlug={area} categorySlug={category} />;
}
