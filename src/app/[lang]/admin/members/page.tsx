import Link from "next/link";
import { Suspense } from "react";
import { MemberActions } from "@/app/admin/members/member-actions";
import { requirePermission } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import type { AccessStatus } from "@/lib/site-access";
import { createClient } from "@/lib/supabase/server";

const TABS: { status: AccessStatus; label: string }[] = [
  { status: "pending", label: "Waiting" },
  { status: "approved", label: "Approved" },
  { status: "rejected", label: "Rejected" },
];

// Auth runs inside Suspense so client navigations between admin pages stream
// instead of blocking.
export default function Page({ searchParams }: PageProps<"/admin/members">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <MembersPage searchParams={searchParams} />
    </Suspense>
  );
}

async function MembersPage({ searchParams }: { searchParams: PageProps<"/admin/members">["searchParams"] }) {
  const { user } = await requirePermission("staff.manage", "/admin/members");
  const params = await searchParams;
  const status = TABS.find((t) => t.status === params.status)?.status ?? "pending";
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("member_access")
    .select("user_id, email, display_name, status, created_at, decided_at")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(500);

  return (
    <div>
      <h1 className="text-2xl font-bold">Members</h1>
      <p className="mt-1 text-sm text-muted">
        Only approved members can use the site. New sign-ups wait here until someone approves them.
      </p>
      <nav className="mt-4 flex gap-1 text-sm">
        {TABS.map((t) => (
          <Link
            key={t.status}
            href={`/admin/members?status=${t.status}`}
            className={`rounded-full px-3 py-1.5 ${t.status === status ? "bg-ink text-white" : "border border-line bg-white"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {(members?.length ?? 0) === 0 ? (
        <p className="mt-6 text-sm text-muted">Nobody here.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-white text-sm">
          {members!.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <span>
                <span className="font-medium">{m.display_name ?? m.email ?? m.user_id}</span>
                {m.display_name && m.email && <span className="text-muted"> · {m.email}</span>}
                <span className="block text-xs text-muted">
                  Signed up {formatDate(m.created_at)}
                  {m.decided_at && ` · decided ${formatDate(m.decided_at)}`}
                </span>
              </span>
              {m.user_id !== user.id && <MemberActions userId={m.user_id} status={m.status as AccessStatus} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
