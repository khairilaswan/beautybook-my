import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My business", robots: { index: false } };

export default function OwnerHome() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Listings />
      </Suspense>
    </div>
  );
}

async function Listings() {
  const user = await requireUser("/owner");
  const supabase = await createClient();
  const { data } = await supabase
    .from("listing_members")
    .select("listing_id, listings ( id, slug, name, status )")
    .eq("user_id", user.id);
  const listings = (data ?? [])
    .map((m) => (m as unknown as { listings: { id: string; slug: string; name: string; status: string } }).listings)
    .filter(Boolean);
  if (listings.length === 1) redirect(`/owner/${listings[0].id}`);
  if (listings.length === 0) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold">You don&apos;t manage a business yet</h1>
        <p className="mt-2 text-muted">Find your shop and claim it, or add it if it isn&apos;t listed.</p>
        <Link href="/for-business" className="mt-6 inline-block rounded-full bg-ink px-5 py-3 font-medium text-white">
          Claim or add your business
        </Link>
      </div>
    );
  }
  return (
    <>
      <h1 className="text-2xl font-bold">Your businesses</h1>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {listings.map((l) => (
          <li key={l.id}>
            <Link href={`/owner/${l.id}`} className="block rounded-2xl border border-line bg-white p-5 hover:border-brand-200">
              <p className="font-semibold">{l.name}</p>
              <p className="text-sm capitalize text-muted">{l.status}</p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
