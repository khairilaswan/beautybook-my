import Link from "next/link";
import { ReportButtons } from "@/app/admin/reports/report-buttons";
import { requirePermission } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";

const REASONS: Record<string, string> = {
  closed: "Shop closed",
  wrong_phone: "Wrong phone",
  wrong_info: "Wrong details",
  removal_request: "Removal request (PDPA)",
  other: "Other",
};

type Report = {
  id: number;
  reason: string;
  details: string | null;
  contact: string | null;
  created_at: string;
  listings: { id: string; name: string; status: string } | null;
};

// Auth runs inside Suspense so client navigations between admin pages stream
// instead of blocking.
export default function Page() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <ReportsPage />
    </Suspense>
  );
}

async function ReportsPage() {
  await requirePermission("reports.review");
  const supabase = await createClient();
  const { data } = await supabase
    .from("reports")
    .select("id, reason, details, contact, created_at, listings ( id, name, status )")
    .eq("status", "open")
    .order("created_at");
  const reports = (data ?? []) as unknown as Report[];
  return (
    <>
      <h1 className="text-2xl font-bold">Open reports</h1>
      <p className="mt-1 text-sm text-muted">Removal requests should be handled within 7 days.</p>
      <ul className="mt-4 space-y-3">
        {reports.map((r) => (
          <li key={r.id} className={`rounded-2xl border bg-white p-4 text-sm ${r.reason === "removal_request" ? "border-brand-500" : "border-line"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{REASONS[r.reason]} · <Link href={`/admin/listings/${r.listings?.id}`} className="hover:underline">{r.listings?.name}</Link></p>
                <p className="text-muted">{formatDate(r.created_at)}{r.contact ? ` · contact: ${r.contact}` : ""} · listing is {r.listings?.status}</p>
                {r.details && <p className="mt-2 whitespace-pre-line">{r.details}</p>}
              </div>
              <ReportButtons reportId={r.id} listingId={r.listings?.id ?? null} reason={r.reason} />
            </div>
          </li>
        ))}
        {reports.length === 0 && <li className="text-muted">Nothing open.</li>}
      </ul>
    </>
  );
}
