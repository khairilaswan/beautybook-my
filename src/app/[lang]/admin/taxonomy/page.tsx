import { AddAreaForm, AddCategoryForm, MallForm } from "@/app/[lang]/admin/taxonomy/forms";
import { requirePermission } from "@/lib/auth";
import { getAreas, getCategories, getMallCounts, getMalls } from "@/lib/data/directory";
import { mallGroups } from "@/lib/mall";
import { mallPath } from "@/lib/paths";
import Link from "next/link";
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
  const [categories, areas, malls, mallCounts] = await Promise.all([getCategories(), getAreas(), getMalls(), getMallCounts()]);
  const areaOptions = areas
    .filter((a) => a.type !== "state")
    .map((a) => ({ slug: a.slug, name: a.name, indent: a.type === "area" }));
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
      <section className="lg:col-span-2" id="malls">
        <h2 className="text-2xl font-bold">Shopping malls <span className="text-base font-normal text-muted">({malls.length})</span></h2>
        <p className="mt-1 text-sm text-muted">
          Customers can filter search by mall, and each mall gets a page at /mall/&lt;slug&gt;. Tag a shop with its mall on
          the listing&apos;s edit page, or with the mall column in an import. Click a mall to edit it.
        </p>
        <div className="mt-4 rounded-2xl border border-line bg-white p-4">
          <h3 className="mb-2 font-semibold">Add a mall</h3>
          <MallForm areas={areaOptions} />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {mallGroups(malls, areas).map(({ city, malls: inCity }) => (
            <div key={city?.slug ?? "none"} className="rounded-2xl border border-line bg-white p-3 text-sm">
              <h3 className="font-semibold">{city?.name ?? "No area"}</h3>
              <ul className="mt-1 divide-y divide-line">
                {inCity.map((m) => (
                  <li key={m.id}>
                    <details className="py-2">
                      <summary className="cursor-pointer">
                        {m.name} <span className="text-muted">· {mallCounts.get(m.slug) ?? 0} shops · /{m.slug}</span>
                      </summary>
                      <div className="mt-2 space-y-2">
                        <Link href={mallPath(m.slug)} className="text-xs underline">View page</Link>
                        <MallForm
                          areas={areaOptions}
                          mall={{ ...m, area_slug: areas.find((a) => a.id === m.area_id)?.slug ?? null }}
                        />
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
