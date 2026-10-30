import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { daysAgoIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";

// Auth runs inside Suspense so client navigations between admin pages stream
// instead of blocking.
export default function Page() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <AdminHome />
    </Suspense>
  );
}

async function AdminHome() {
  await requirePermission(null);
  const supabase = await createClient();
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const head = { count: "exact" as const, head: true };
  const [active, hidden, unverified, ownerAdded, claims, reports, requests, queue] = await Promise.all([
    count(supabase.from("listings").select("id", head).eq("status", "active")),
    count(supabase.from("listings").select("id", head).eq("status", "hidden")),
    count(supabase.from("listings").select("id", head).eq("status", "active").lt("last_verified_at", daysAgoIso(180))),
    count(supabase.from("listings").select("id", head).eq("source", "owner").gte("created_at", daysAgoIso(7))),
    count(supabase.from("claims").select("id", head).eq("status", "pending")),
    count(supabase.from("reports").select("id", head).eq("status", "open")),
    count(supabase.from("booking_requests").select("id", head).gte("created_at", daysAgoIso(7))),
    count(supabase.from("discovery_queue").select("google_place_id", head).eq("status", "new")),
  ]);
  const tiles = [
    { label: "Active listings", value: active, href: "/admin/listings?status=active" },
    { label: "Hidden listings", value: hidden, href: "/admin/listings?status=hidden" },
    { label: "Not checked in 6 months", value: unverified, href: "/admin/listings?stale=1" },
    { label: "Added by owners this week", value: ownerAdded, href: "/admin/listings?source=owner" },
    { label: "Claims to review", value: claims, href: "/admin/claims" },
    { label: "Open reports", value: reports, href: "/admin/reports" },
    { label: "Booking requests, 7 days", value: requests, href: "/admin/listings" },
    { label: "Shops to collect", value: queue, href: "/admin/discovery" },
  ];
  return (
    <>
      <h1 className="text-2xl font-bold">Overview</h1>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="rounded-2xl border border-line bg-white p-4 hover:border-brand-200">
            <p className="text-2xl font-bold">{t.value}</p>
            <p className="text-sm text-muted">{t.label}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
