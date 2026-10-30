import Link from "next/link";
import { ClaimButtons } from "@/app/admin/claims/claim-buttons";
import { requirePermission } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";

type Claim = {
  id: number;
  method: string;
  evidence_path: string | null;
  note: string | null;
  created_at: string;
  user_id: string;
  listings: { id: string; slug: string; name: string; phone: string | null } | null;
};

// Auth runs inside Suspense so client navigations between admin pages stream
// instead of blocking.
export default function Page() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <ClaimsPage />
    </Suspense>
  );
}

async function ClaimsPage() {
  await requirePermission("claims.review");
  const supabase = await createClient();
  const { data } = await supabase
    .from("claims")
    .select("id, method, evidence_path, note, created_at, user_id, listings ( id, slug, name, phone )")
    .eq("status", "pending")
    .eq("method", "document")
    .order("created_at");
  const claims = (data ?? []) as unknown as Claim[];
  const links = await Promise.all(
    claims.map(async (c) =>
      c.evidence_path
        ? (await supabase.storage.from("claim-evidence").createSignedUrl(c.evidence_path, 60 * 30)).data?.signedUrl
        : null,
    ),
  );
  return (
    <>
      <h1 className="text-2xl font-bold">Claims to review</h1>
      <p className="mt-1 text-sm text-muted">
        Only document claims need review. WhatsApp-code claims are approved automatically.
      </p>
      <ul className="mt-4 space-y-3">
        {claims.map((c, i) => (
          <li key={c.id} className="rounded-2xl border border-line bg-white p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link href={`/admin/listings/${c.listings?.id}`} className="font-semibold hover:underline">{c.listings?.name}</Link>
                <p className="text-muted">Submitted {formatDate(c.created_at)} · user {c.user_id.slice(0, 8)}</p>
                {c.note && <p className="mt-2">“{c.note}”</p>}
                {links[i] && <a href={links[i]!} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block underline">Open evidence</a>}
              </div>
              <ClaimButtons claimId={c.id} />
            </div>
          </li>
        ))}
        {claims.length === 0 && <li className="text-muted">Nothing waiting.</li>}
      </ul>
    </>
  );
}
