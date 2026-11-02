import { AddAreaForm, AddCategoryForm } from "@/app/admin/taxonomy/forms";
import { requirePermission } from "@/lib/auth";
import { getAreas, getCategories } from "@/lib/data/directory";
import { Suspense } from "react";

// Auth runs inside Suspense so client navigations between admin pages stream
// instead of blocking.
export default function Page() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <TaxonomyPage />
    </Suspense>
  );
}

async function TaxonomyPage() {
  await requirePermission("taxonomy.edit");
  const [categories, areas] = await Promise.all([getCategories(), getAreas()]);
  const top = areas.filter((a) => a.parent_id === null);
  const children = (id: number) => areas.filter((a) => a.parent_id === id);
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section>
        <h1 className="text-2xl font-bold">Categories</h1>
        <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-white text-sm">
          {categories.map((c) => (
            <li key={c.slug} className="p-3">
              <strong>{c.name_en}</strong> · {c.name_ms} <span className="text-muted">/{c.slug}</span>
            </li>
          ))}
        </ul>
        <AddCategoryForm />
      </section>
      <section>
        <h2 className="text-2xl font-bold">Areas</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {top.map((t) => (
            <li key={t.slug} className="rounded-2xl border border-line bg-white p-3">
              <strong>{t.name}</strong>
              <ul className="mt-1 text-muted">
                {children(t.id).map((c) => (
                  <li key={c.slug}>
                    {c.name}
                    {children(c.id).length > 0 && `: ${children(c.id).map((a) => a.name).join(", ")}`}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <AddAreaForm parents={areas.filter((a) => a.type !== "area").map((a) => ({ slug: a.slug, name: a.name }))} />
      </section>
    </div>
  );
}
