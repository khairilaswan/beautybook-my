import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FeaturedButtons, GrantFeaturedForm } from "@/app/[lang]/admin/featured/featured-forms";
import { requirePermission } from "@/lib/auth";
import { getAreas, getCategories } from "@/lib/data/directory";
import { formatDate } from "@/lib/format";
import { listingPath } from "@/lib/paths";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Featured" };

export default function Page() {
  return (
    <>
      <h1 className="text-2xl font-bold">Featured placement</h1>
      <p className="mt-1 text-muted">
        Featured shops sit at the top of search and area pages with a badge. Owners request or pay from their dashboard;
        you can also feature a shop here.
      </p>
      <Suspense fallback={<p className="mt-6 text-muted">Loading…</p>}>
        <Featured />
      </Suspense>
    </>
  );
}

async function Featured() {
  await requirePermission("billing.manage");
  const supabase = await createClient();
  const [{ data }, areas, categories] = await Promise.all([
    supabase
      .from("featured_placements")
      .select("id, status, starts_at, ends_at, area_id, category_id, amount_rm, note, created_at, listings ( slug, name )")
      .in("status", ["requested", "pending_payment", "active"])
      .order("created_at", { ascending: false })
      .limit(200),
    getAreas(),
    getCategories(),
  ]);
  const rows = data ?? [];
  const label = (r: (typeof rows)[number]) =>
    [areas.find((a) => a.id === r.area_id)?.name ?? "Everywhere", categories.find((c) => c.id === r.category_id)?.name_en ?? "all services"].join(" · ");
  const now = new Date().toISOString();
  const groups = [
    { title: "Requests", items: rows.filter((r) => r.status === "requested") },
    { title: "Live", items: rows.filter((r) => r.status === "active" && r.ends_at > now) },
    { title: "Waiting for payment", items: rows.filter((r) => r.status === "pending_payment") },
  ];
  return (
    <div className="mt-6 space-y-8">
      {groups.map((g) => (
        <section key={g.title}>
          <h2 className="text-lg font-semibold">{g.title}</h2>
          {g.items.length === 0 ? (
            <p className="mt-1 text-sm text-muted">None.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line rounded-2xl border border-line bg-white text-sm">
              {g.items.map((r) => {
                const l = r.listings as unknown as { slug: string; name: string };
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <span>
                      <Link href={listingPath(l.slug)} className="font-medium underline">{l.name}</Link>
                      <span className="block text-muted">
                        {label(r)}
                        {r.status === "active" ? ` · until ${formatDate(r.ends_at)}` : ` · asked ${formatDate(r.created_at)}`}
                        {r.amount_rm ? ` · RM${r.amount_rm}` : ""}
                      </span>
                      {r.note && <span className="block">“{r.note}”</span>}
                    </span>
                    <FeaturedButtons id={r.id} status={r.status} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
      <section>
        <h2 className="text-lg font-semibold">Feature a shop</h2>
        <GrantFeaturedForm areas={areas.filter((a) => a.type !== "state")} categories={categories} />
      </section>
    </div>
  );
}
