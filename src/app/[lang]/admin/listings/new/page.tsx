import { ListingForm } from "@/app/admin/listings/listing-form";
import { requirePermission } from "@/lib/auth";
import { getAreas, getAttributes, getCategories } from "@/lib/data/directory";
import { Suspense } from "react";

// Auth runs inside Suspense so client navigations between admin pages stream
// instead of blocking.
export default function Page() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <NewListingPage />
    </Suspense>
  );
}

async function NewListingPage() {
  await requirePermission("listings.edit");
  const [areas, categories, attributes] = await Promise.all([getAreas(), getCategories(), getAttributes()]);
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">New listing</h1>
      <ListingForm listing={null} areas={areas} categories={categories} attributes={attributes} />
    </>
  );
}
