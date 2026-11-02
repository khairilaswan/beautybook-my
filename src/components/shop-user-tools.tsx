import { listingPath } from "@/lib/paths";
import Link from "next/link";
import { ShopUserToolsClient } from "@/components/shop-user-tools-client";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

// Save and private note, for signed-in visitors. Reads the session, so the
// shop page renders it behind a Suspense boundary.
export async function ShopUserTools({ listingId, slug }: { listingId: string; slug: string }) {
  const [user, { t, href }] = await Promise.all([getCurrentUser(), getI18n()]);
  if (!user) {
    return (
      <Link
        href={href(`/login?next=${encodeURIComponent(href(listingPath(slug)))}`)}
        className="rounded-full border border-line bg-white px-4 py-2 text-sm hover:border-brand-200"
      >
        {t.userTools.save}
      </Link>
    );
  }
  const supabase = await createClient();
  const [{ data: fav }, { data: note }] = await Promise.all([
    supabase.from("favourites").select("listing_id").eq("listing_id", listingId).maybeSingle(),
    supabase.from("notes").select("body").eq("listing_id", listingId).maybeSingle(),
  ]);
  return <ShopUserToolsClient listingId={listingId} slug={slug} saved={!!fav} note={note?.body ?? ""} />;
}
