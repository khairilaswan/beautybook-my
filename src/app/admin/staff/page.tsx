import { AddStaffForm, RoleForm, StaffRow } from "@/app/admin/staff/staff-forms";
import { requirePermission } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";

const PERMISSIONS = [
  ["listings.edit", "Edit listings"],
  ["listings.import", "Bulk import"],
  ["claims.review", "Review claims"],
  ["reports.review", "Handle reports"],
  ["taxonomy.edit", "Categories & areas"],
  ["seo.edit", "Redirects"],
  ["staff.manage", "Manage staff"],
  ["billing.manage", "Billing"],
  ["audit.view", "Audit log"],
] as const;

// Auth runs inside Suspense so client navigations between admin pages stream
// instead of blocking.
export default function Page() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <StaffPage />
    </Suspense>
  );
}

async function StaffPage() {
  const { user } = await requirePermission("staff.manage");
  const supabase = await createClient();
  const [{ data: roles }, { data: staff }] = await Promise.all([
    supabase.from("roles").select("id, slug, name, description, permissions, is_system").order("id"),
    supabase.from("staff").select("user_id, role_id, created_at").order("created_at"),
  ]);
  // Emails live in auth.users, which only the service role can read.
  const admin = createAdminClient();
  const people = await Promise.all(
    (staff ?? []).map(async (s) => {
      const { data } = await admin.auth.admin.getUserById(s.user_id);
      return { ...s, email: data.user?.email ?? data.user?.phone ?? s.user_id };
    }),
  );
  const roleOptions = (roles ?? []).map((r) => ({ id: r.id, name: r.name }));

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-bold">Staff</h1>
        <p className="mt-1 text-sm text-muted">Each person has one role. New emails get an invitation to sign in.</p>
        <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-white text-sm">
          {people.map((p) => (
            <StaffRow key={p.user_id} userId={p.user_id} email={p.email} roleId={p.role_id} roles={roleOptions} isMe={p.user_id === user.id} />
          ))}
        </ul>
        <AddStaffForm roles={roleOptions} />
      </section>
      <section>
        <h2 className="text-xl font-semibold">Roles</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {(roles ?? []).map((r) =>
            r.is_system ? (
              <div key={r.id} className="rounded-2xl border border-line bg-white p-4 text-sm">
                <p className="font-semibold">{r.name}</p>
                <p className="text-muted">{r.description} Can&apos;t be edited.</p>
              </div>
            ) : (
              <RoleForm key={r.id} role={r} permissions={PERMISSIONS} />
            ),
          )}
          <RoleForm role={null} permissions={PERMISSIONS} />
        </div>
      </section>
    </div>
  );
}
