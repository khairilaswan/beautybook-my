import "server-only";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Permission =
  | "listings.edit"
  | "listings.import"
  | "claims.review"
  | "reports.review"
  | "taxonomy.edit"
  | "seo.edit"
  | "staff.manage"
  | "billing.manage"
  | "audit.view";

export type CurrentUser = {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
};

export type StaffInfo = {
  roleSlug: string;
  roleName: string;
  permissions: string[];
};

// Verifies the session with Supabase Auth (not just the cookie).
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const meta = data.user.user_metadata ?? {};
  return {
    id: data.user.id,
    email: data.user.email ?? null,
    phone: data.user.phone || null,
    displayName: (meta.full_name as string) ?? (meta.name as string) ?? null,
  };
}

export async function requireUser(next: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function getStaff(userId: string): Promise<StaffInfo | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff")
    .select("roles ( slug, name, permissions )")
    .eq("user_id", userId)
    .maybeSingle();
  const role = (data as unknown as { roles: { slug: string; name: string; permissions: string[] } } | null)?.roles;
  return role ? { roleSlug: role.slug, roleName: role.name, permissions: role.permissions } : null;
}

export function can(staff: StaffInfo | null, perm: Permission): boolean {
  return !!staff && (staff.permissions.includes("all") || staff.permissions.includes(perm));
}

// For admin pages and actions. The database enforces the same rules through
// RLS; this check shows a 404 so the admin area stays invisible to others.
export async function requirePermission(perm: Permission | null, next = "/admin") {
  const user = await requireUser(next);
  const staff = await getStaff(user.id);
  if (!staff || (perm && !can(staff, perm))) notFound();
  return { user, staff };
}
