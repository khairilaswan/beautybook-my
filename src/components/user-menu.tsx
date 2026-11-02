import Link from "next/link";
import { getCurrentUser, getStaff } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";

// Reads the session, so it renders behind a Suspense boundary.
export async function UserMenu() {
  const [user, { t, href }] = await Promise.all([getCurrentUser(), getI18n()]);
  if (!user) {
    return (
      <Link
        href={href("/login")}
        className="rounded-full bg-ink px-2.5 py-1.5 font-medium sm:px-3 text-white hover:bg-black"
      >
        {t.nav.signIn}
      </Link>
    );
  }
  const staff = await getStaff(user.id);
  return (
    <>
      {staff && (
        <Link href="/admin" className="rounded-full px-3 py-1.5 hover:bg-brand-50">
          {t.nav.admin}
        </Link>
      )}
      <Link
        href={href("/account")}
        className="rounded-full bg-brand-50 px-3 py-1.5 font-medium text-brand-700 hover:bg-brand-100"
      >
        {user.displayName?.split(" ")[0] ?? t.nav.account}
      </Link>
    </>
  );
}
