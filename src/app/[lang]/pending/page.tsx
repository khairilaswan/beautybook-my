import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Waiting for approval", robots: { index: false } };

// Signed-in accounts that aren't approved yet land here (see src/proxy.ts).
export default function PendingPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Pending />
      </Suspense>
    </div>
  );
}

async function Pending() {
  const user = await requireUser("/pending");
  const supabase = await createClient();
  const { data } = await supabase.from("member_access").select("status").eq("user_id", user.id).maybeSingle();
  const rejected = data?.status === "rejected";
  return (
    <>
      <h1 className="text-2xl font-bold">{rejected ? "Your account wasn't approved" : "Thanks for signing up"}</h1>
      <p className="mt-3 text-muted">
        {rejected
          ? "BeautyBook is open to approved members only for now, and this account hasn't been given access."
          : "BeautyBook is open to approved members only for now. We'll review your account soon. Once it's approved, just come back and you'll be let in."}
      </p>
      <p className="mt-3 text-sm text-muted">Signed in as {user.email ?? user.phone}.</p>
      <div className="mt-6 flex gap-2">
        {!rejected && (
          <Link href="/pending" prefetch={false} className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white">
            Check again
          </Link>
        )}
        <form action="/auth/signout" method="post">
          <button className="rounded-full border border-line bg-white px-4 py-2 text-sm">Sign out</button>
        </form>
      </div>
    </>
  );
}
