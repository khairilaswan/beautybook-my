import Link from "next/link";
import { ADMIN_PAGE_SIZE, queryListings, readFilters } from "@/app/admin/listings/query";
import { requirePermission } from "@/lib/auth";
import { getAreas } from "@/lib/data/directory";
import { formatDate } from "@/lib/format";
import { Suspense } from "react";

type Row = {
  id: string;
  slug: string;
  name: string;
  status: string;
  source: string;
  phone: string | null;
  last_verified_at: string | null;
  updated_at: string;
  areas: { name: string } | null;
};

// Auth runs inside Suspense so client navigations between admin pages stream
// instead of blocking.
export default function Page(props: PageProps<"/admin/listings">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <AdminListings {...props} />
    </Suspense>
  );
}

async function AdminListings({ searchParams }: PageProps<"/admin/listings">) {
  await requirePermission("listings.edit");
  const filters = readFilters(await searchParams);
  const page = filters.page ?? 1;
  const [areas, result] = await Promise.all([
    getAreas(),
    queryListings(
      filters,
      "id, slug, name, status, source, phone, last_verified_at, updated_at, areas ( name )",
      ADMIN_PAGE_SIZE,
      (page - 1) * ADMIN_PAGE_SIZE,
    ),
  ]);
  const rows = (result.data ?? []) as unknown as Row[];
  const total = result.count ?? 0;
  const qs = (extra: Record<string, string | number>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filters, ...extra })) if (v) p.set(k, String(v));
    return p.toString();
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Listings <span className="text-base font-normal text-muted">({total})</span></h1>
        <div className="flex gap-2 text-sm">
          <a href={`/admin/listings/export?${qs({ page: "" })}`} className="rounded-full border border-line bg-white px-4 py-2">
            Export CSV
          </a>
          <Link href="/admin/listings/new" className="rounded-full bg-ink px-4 py-2 font-medium text-white">
            New listing
          </Link>
        </div>
      </div>
      <form className="mt-4 flex flex-wrap gap-2 text-sm">
        <input name="q" defaultValue={filters.q} placeholder="Name, slug or phone" className="rounded-xl border border-line px-3 py-2" />
        <select name="status" defaultValue={filters.status ?? ""} className="rounded-xl border border-line px-3 py-2">
          <option value="">Any status</option>
          {["active", "hidden", "closed", "archived"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <select name="area" defaultValue={filters.area ?? ""} className="rounded-xl border border-line px-3 py-2">
          <option value="">Any area</option>
          {areas.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
        </select>
        <select name="source" defaultValue={filters.source ?? ""} className="rounded-xl border border-line px-3 py-2">
          <option value="">Any source</option>
          {["manual", "import", "owner", "open_data"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <label className="flex items-center gap-2 px-2">
          <input type="checkbox" name="stale" value="1" defaultChecked={!!filters.stale} /> Not checked in 6 months
        </label>
        <button className="rounded-xl bg-ink px-4 py-2 text-white">Filter</button>
      </form>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-left text-muted">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Area</th>
              <th className="p-3">Status</th>
              <th className="p-3">Source</th>
              <th className="p-3">Last checked</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} className="border-t border-line">
                <td className="p-3">
                  <Link href={`/admin/listings/${l.id}`} className="font-medium hover:underline">{l.name}</Link>
                  <span className="block text-xs text-muted">{l.slug}</span>
                </td>
                <td className="p-3">{l.areas?.name}</td>
                <td className="p-3 capitalize">{l.status}</td>
                <td className="p-3">{l.source}</td>
                <td className="p-3">{l.last_verified_at ? formatDate(l.last_verified_at) : "Never"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > ADMIN_PAGE_SIZE && (
        <nav className="mt-4 flex justify-between text-sm">
          {page > 1 ? <Link href={`/admin/listings?${qs({ page: page - 1 })}`} className="underline">Previous</Link> : <span />}
          <span className="text-muted">Page {page} of {Math.ceil(total / ADMIN_PAGE_SIZE)}</span>
          {page * ADMIN_PAGE_SIZE < total ? <Link href={`/admin/listings?${qs({ page: page + 1 })}`} className="underline">Next</Link> : <span />}
        </nav>
      )}
    </>
  );
}
