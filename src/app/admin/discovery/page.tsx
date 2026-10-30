import { DiscoveryRow } from "@/app/admin/discovery/discovery-row";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";

// Place IDs found by scripts/discover-places.ts. Staff open each in Google
// Maps, find the shop's own Instagram, Facebook or website, and add the
// listing from those sources. Nothing from Google is stored except the ID.
// Auth runs inside Suspense so client navigations between admin pages stream
// instead of blocking.
export default function Page(props: PageProps<"/admin/discovery">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <DiscoveryPage {...props} />
    </Suspense>
  );
}

async function DiscoveryPage({ searchParams }: PageProps<"/admin/discovery">) {
  await requirePermission("listings.edit");
  const { status } = await searchParams;
  const current = status === "collected" || status === "skipped" ? status : "new";
  const supabase = await createClient();
  const { data, count } = await supabase
    .from("discovery_queue")
    .select("google_place_id, search_term, cell, status, created_at", { count: "exact" })
    .eq("status", current)
    .order("created_at")
    .limit(100);
  return (
    <>
      <h1 className="text-2xl font-bold">Discovery queue <span className="text-base font-normal text-muted">({count ?? 0} {current})</span></h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Open each place in Google Maps to see which shop it is, then collect its details from the shop&apos;s own Instagram,
        Facebook or website and add the listing. Don&apos;t copy text, hours or photos from Google.
      </p>
      <nav className="mt-4 flex gap-2 text-sm">
        {["new", "collected", "skipped"].map((s) => (
          <a key={s} href={`/admin/discovery?status=${s}`} className={`rounded-full px-3 py-1 ${s === current ? "bg-ink text-white" : "border border-line bg-white"}`}>
            {s}
          </a>
        ))}
      </nav>
      <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-white text-sm">
        {(data ?? []).map((d) => (
          <DiscoveryRow key={d.google_place_id} placeId={d.google_place_id} term={d.search_term} cell={d.cell} status={d.status} />
        ))}
        {!data?.length && <li className="p-3 text-muted">Nothing here.</li>}
      </ul>
    </>
  );
}
