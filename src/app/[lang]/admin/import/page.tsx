import { ImportTool, UndoButton } from "@/app/admin/import/import-tool";
import { requirePermission } from "@/lib/auth";
import { getAreas, getAttributes, getCategories } from "@/lib/data/directory";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";

// Auth runs inside Suspense so client navigations between admin pages stream
// instead of blocking.
export default function Page() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <ImportPage />
    </Suspense>
  );
}

async function ImportPage() {
  await requirePermission("listings.import");
  const supabase = await createClient();
  const [batches, categories, areas, attributes] = await Promise.all([
    supabase.from("import_batches").select("id, filename, status, counts, created_at").order("created_at", { ascending: false }).limit(20),
    getCategories(),
    getAreas(),
    getAttributes(),
  ]);
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Bulk import</h1>
        <p className="mt-1 text-sm text-muted">
          Upload a .csv, .xlsx or .json file. You&apos;ll see what will be created, updated or skipped before anything is saved.
          Rows match existing listings by slug, then Google place ID, then phone. Blank cells keep existing values.
        </p>
      </div>
      <ImportTool />
      <section>
        <h2 className="text-lg font-semibold">Past imports</h2>
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white text-sm">
          {(batches.data ?? []).map((b) => {
            const c = b.counts as Record<string, number>;
            return (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span>
                  <strong>{b.filename}</strong> · {formatDate(b.created_at)} · {c.created ?? 0} created, {c.updated ?? 0} updated,{" "}
                  {c.skipped ?? 0} skipped{b.status === "undone" ? " · undone" : ""}
                </span>
                {b.status !== "undone" && <UndoButton batchId={b.id} />}
              </li>
            );
          })}
          {!batches.data?.length && <li className="p-3 text-muted">No imports yet.</li>}
        </ul>
      </section>
      <section className="text-sm">
        <h2 className="text-lg font-semibold">Accepted codes</h2>
        <p className="mt-2"><strong>category / other_categories:</strong> {categories.map((c) => c.slug).join(", ")}</p>
        <p className="mt-2"><strong>area:</strong> {areas.filter((a) => a.type !== "state").map((a) => a.slug).join(", ")}</p>
        <p className="mt-2"><strong>attributes:</strong> {attributes.map((a) => a.slug).join(", ")}</p>
        <p className="mt-2"><strong>hours:</strong> e.g. <code>Mon-Sat 10:00-21:00; Fri 10:00-13:00,14:30-21:00; Sun closed</code></p>
      </section>
    </div>
  );
}
