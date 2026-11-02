import { RedirectForm, DeleteRedirect } from "@/app/admin/seo/forms";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";

// Auth runs inside Suspense so client navigations between admin pages stream
// instead of blocking.
export default function Page() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <SeoPage />
    </Suspense>
  );
}

async function SeoPage() {
  await requirePermission("seo.edit");
  const supabase = await createClient();
  const { data } = await supabase.from("redirects").select("from_path, to_path, created_at").order("created_at", { ascending: false }).limit(500);
  return (
    <>
      <h1 className="text-2xl font-bold">Redirects</h1>
      <p className="mt-1 text-sm text-muted">
        Old shop URLs redirect permanently to their new address. Renaming a listing&apos;s slug adds one automatically.
      </p>
      <RedirectForm />
      <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-white text-sm">
        {(data ?? []).map((r) => (
          <li key={r.from_path} className="flex items-center justify-between gap-2 p-3">
            <span className="font-mono text-xs">{r.from_path} → {r.to_path}</span>
            <DeleteRedirect from={r.from_path} />
          </li>
        ))}
        {!data?.length && <li className="p-3 text-muted">No redirects yet.</li>}
      </ul>
    </>
  );
}
