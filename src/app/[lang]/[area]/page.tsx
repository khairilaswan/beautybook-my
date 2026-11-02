import { Suspense } from "react";
import { HubPage, HubSkeleton } from "@/components/hub-page";
import { hubMetadata } from "@/lib/hub-metadata";

export async function generateMetadata({ params }: PageProps<"/[area]">) {
  const { area } = await params;
  return hubMetadata(area, null);
}

export default function AreaPage({ params }: PageProps<"/[area]">) {
  return (
    <Suspense fallback={<HubSkeleton />}>
      <AreaHub params={params} />
    </Suspense>
  );
}

async function AreaHub({ params }: { params: PageProps<"/[area]">["params"] }) {
  const { area } = await params;
  return <HubPage areaSlug={area} categorySlug={null} />;
}
