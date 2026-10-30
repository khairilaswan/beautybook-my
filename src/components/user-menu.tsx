import Link from "next/link";
import { getCurrentUser, getStaff } from "@/lib/auth";

// Reads the session, so it renders behind a Suspense boundary.
export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Link
        href="/login"
        className="rounded-full bg-ink px-3 py-1.5 font-medium text-white hover:bg-black"
      >
        Sign in
      </Link>
    );
  }
  const staff = await getStaff(user.id);
  return (
    <>
      {staff && (
        <Link href="/admin" className="rounded-full px-3 py-1.5 hover:bg-brand-50">
          Admin
        </Link>
      )}
      <Link
        href="/account"
        className="rounded-full bg-brand-50 px-3 py-1.5 font-medium text-brand-700 hover:bg-brand-100"
      >
        {user.displayName?.split(" ")[0] ?? "Account"}
      </Link>
    </>
  );
}
