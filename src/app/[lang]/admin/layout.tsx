import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { can, requirePermission } from "@/lib/auth";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

const NAV = [
  { href: "/admin", label: "Overview", perm: null },
  { href: "/admin/listings", label: "Listings", perm: "listings.edit" },
  { href: "/admin/import", label: "Import", perm: "listings.import" },
  { href: "/admin/discovery", label: "Discovery queue", perm: "listings.edit" },
  { href: "/admin/claims", label: "Claims", perm: "claims.review" },
  { href: "/admin/reports", label: "Reports", perm: "reports.review" },
  { href: "/admin/taxonomy", label: "Categories & areas", perm: "taxonomy.edit" },
  { href: "/admin/seo", label: "Redirects", perm: "seo.edit" },
  { href: "/admin/guides", label: "Guides", perm: "seo.edit" },
  { href: "/admin/featured", label: "Featured", perm: "billing.manage" },
  { href: "/admin/features", label: "Features", perm: "staff.manage" },
  { href: "/admin/members", label: "Members", perm: "staff.manage" },
  { href: "/admin/staff", label: "Staff & roles", perm: "staff.manage" },
  { href: "/admin/theme", label: "Theme", perm: "staff.manage" },
  { href: "/admin/website", label: "Website settings", perm: "staff.manage" },
  { href: "/admin/audit", label: "Audit log", perm: "audit.view" },
] as const;

export default function AdminLayout({ children }: LayoutProps<"/[lang]/admin">) {
  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[200px_1fr]">
      <Suspense fallback={<nav />}>
        <AdminNav />
      </Suspense>
      {/* admin/loading.tsx wraps children, so client navigations between admin pages stream too. */}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

async function AdminNav() {
  const { staff } = await requirePermission(null);
  return (
    <nav className="text-sm">
      <p className="mb-2 text-xs uppercase tracking-wide text-muted">{staff.roleName}</p>
      <ul className="flex flex-wrap gap-1 lg:flex-col">
        {NAV.filter((n) => !n.perm || can(staff, n.perm)).map((n) => (
          <li key={n.href}>
            <Link href={n.href} className="block rounded-lg px-3 py-1.5 hover:bg-white">
              {n.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
