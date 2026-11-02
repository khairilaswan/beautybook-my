import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";

type Entry = {
  id: number;
  actor_id: string | null;
  action: string;
  table_name: string;
  record_id: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
};

function changedFields(e: Entry): string[] {
  if (!e.before || !e.after) return [];
  return Object.keys(e.after).filter(
    (k) => k !== "updated_at" && JSON.stringify(e.before![k]) !== JSON.stringify(e.after![k]),
  );
}

// Auth runs inside Suspense so client navigations between admin pages stream
// instead of blocking.
export default function Page(props: PageProps<"/admin/audit">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <AuditPage {...props} />
    </Suspense>
  );
}

async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requirePermission("audit.view");
  const { table, record } = await searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("audit_log")
    .select("id, actor_id, action, table_name, record_id, before, after, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (typeof table === "string" && table) query = query.eq("table_name", table);
  if (typeof record === "string" && record) query = query.eq("record_id", record);
  const { data } = await query;
  const entries = (data ?? []) as Entry[];
  return (
    <>
      <h1 className="text-2xl font-bold">Audit log</h1>
      <form className="mt-4 flex gap-2 text-sm">
        <input name="table" defaultValue={typeof table === "string" ? table : ""} placeholder="table, e.g. listings" className="rounded-xl border border-line px-3 py-2" />
        <input name="record" defaultValue={typeof record === "string" ? record : ""} placeholder="record id" className="rounded-xl border border-line px-3 py-2" />
        <button className="rounded-xl bg-ink px-4 py-2 text-white">Filter</button>
      </form>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-left text-muted">
            <tr><th className="p-2">When</th><th className="p-2">Who</th><th className="p-2">What</th><th className="p-2">Changed</th></tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const fields = changedFields(e);
              return (
                <tr key={e.id} className="border-t border-line align-top">
                  <td className="whitespace-nowrap p-2">{new Date(e.created_at).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" })}</td>
                  <td className="p-2 font-mono text-xs">{e.actor_id?.slice(0, 8) ?? "system"}</td>
                  <td className="p-2">{e.action} {e.table_name} <span className="font-mono text-xs text-muted">{e.record_id.slice(0, 12)}</span></td>
                  <td className="p-2">
                    {fields.map((f) => (
                      <span key={f} className="block">
                        <strong>{f}</strong>: {JSON.stringify(e.before?.[f])} → {JSON.stringify(e.after?.[f])}
                      </span>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
