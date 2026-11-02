import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requirePermission } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Guides" };

export default function Page() {
  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Guides</h1>
        <Link href="/admin/guides/new" className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white">New guide</Link>
      </div>
      <p className="mt-1 text-muted">
        Articles like “Best nail salons in Bangsar” or “Bridal makeup prices 2026”. Link a guide to an area and service and
        it lists those shops underneath. Published guides go in the sitemap.
      </p>
      <Suspense fallback={<p className="mt-6 text-muted">Loading…</p>}>
        <List />
      </Suspense>
    </>
  );
}

async function List() {
  await requirePermission("seo.edit");
  const supabase = await createClient();
  const { data } = await supabase.from("guides").select("id, slug, title, status, updated_at").order("updated_at", { ascending: false });
  if (!data?.length) return <p className="mt-6 text-muted">No guides yet.</p>;
  return (
    <ul className="mt-6 divide-y divide-line rounded-2xl border border-line bg-white text-sm">
      {data.map((g) => (
        <li key={g.id} className="flex items-center justify-between gap-2 p-4">
          <Link href={`/admin/guides/${g.id}`} className="font-medium hover:underline">{g.title}</Link>
          <span className="text-muted">
            {g.status === "published" ? (
              <Link href={`/guides/${g.slug}`} className="underline">Live</Link>
            ) : (
              "Draft"
            )}{" "}
            · {formatDate(g.updated_at)}
          </span>
        </li>
      ))}
    </ul>
  );
}
