import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProfileForm } from "@/app/account/profile-form";
import { clearSearchHistory } from "@/app/account/actions";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

const STATUS_LABELS: Record<string, string> = {
  sent: "Sent",
  confirmed: "Confirmed by shop",
  declined: "Declined",
  no_show: "Marked no-show",
  completed: "Completed",
};

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Account />
      </Suspense>
    </div>
  );
}

type ListingRef = { slug: string; name: string } | null;

async function Account() {
  const user = await requireUser("/account");
  const supabase = await createClient();
  const [profile, requests, favourites, notes, searches, memberships] = await Promise.all([
    supabase.from("profiles").select("display_name, phone, preferred_lang").eq("id", user.id).maybeSingle(),
    supabase
      .from("booking_requests")
      .select("id, service_name, preferred_at, status, created_at, listings ( slug, name )")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("favourites").select("created_at, listings ( slug, name )").order("created_at", { ascending: false }),
    supabase.from("notes").select("body, updated_at, listings ( slug, name )").order("updated_at", { ascending: false }),
    supabase.from("search_history").select("id, query, category_slug, area_slug, created_at").order("created_at", { ascending: false }).limit(10),
    supabase.from("listing_members").select("listing_id").eq("user_id", user.id).limit(1),
  ]);
  const ref = (x: unknown) => (x as { listings: ListingRef }).listings;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Hi{profile.data?.display_name ? `, ${profile.data.display_name}` : ""}</h1>
        <div className="flex gap-2">
          {(memberships.data?.length ?? 0) > 0 && (
            <Link href="/owner" className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white">
              My business
            </Link>
          )}
          <form action="/auth/signout" method="post">
            <button className="rounded-full border border-line bg-white px-4 py-2 text-sm">Sign out</button>
          </form>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold">Booking requests</h2>
        {requests.data?.length ? (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">
            {requests.data.map((r) => {
              const listing = ref(r);
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <div>
                    <p className="font-medium">{listing?.name ?? "Shop removed"}</p>
                    <p className="text-sm text-muted">
                      {r.service_name}
                      {r.preferred_at ? ` · ${formatDate(r.preferred_at)}` : ""} · {STATUS_LABELS[r.status] ?? r.status}
                    </p>
                  </div>
                  {listing && (
                    <Link href={`/shop/${listing.slug}#book`} className="rounded-full border border-line px-3 py-1 text-sm hover:border-brand-200">
                      Book again
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-muted">No requests yet. <Link href="/search" className="underline">Find a shop</Link>.</p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Saved shops</h2>
        {favourites.data?.length ? (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {favourites.data.map((f) => {
              const listing = ref(f);
              return listing ? (
                <li key={listing.slug}>
                  <Link href={`/shop/${listing.slug}`} className="block rounded-xl border border-line bg-white p-3 hover:border-brand-200">
                    {listing.name}
                  </Link>
                </li>
              ) : null;
            })}
          </ul>
        ) : (
          <p className="mt-2 text-muted">Tap “Save” on a shop to keep it here.</p>
        )}
      </section>

      {notes.data && notes.data.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">My notes</h2>
          <ul className="mt-3 space-y-2">
            {notes.data.map((n) => {
              const listing = ref(n);
              return listing ? (
                <li key={listing.slug} className="rounded-xl border border-line bg-white p-3">
                  <Link href={`/shop/${listing.slug}`} className="font-medium hover:underline">{listing.name}</Link>
                  <p className="mt-1 whitespace-pre-line text-sm">{n.body}</p>
                </li>
              ) : null;
            })}
          </ul>
        </section>
      )}

      {searches.data && searches.data.length > 0 && (
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Search history</h2>
            <form action={clearSearchHistory}>
              <button className="text-sm text-muted underline">Clear</button>
            </form>
          </div>
          <ul className="mt-3 flex flex-wrap gap-2 text-sm">
            {searches.data.map((s) => {
              const qs = new URLSearchParams();
              if (s.query) qs.set("q", s.query);
              if (s.category_slug) qs.set("category", s.category_slug);
              if (s.area_slug) qs.set("area", s.area_slug);
              return (
                <li key={s.id}>
                  <Link href={`/search?${qs}`} className="inline-block rounded-full bg-white px-3 py-1 hover:bg-brand-50">
                    {[s.query, s.category_slug, s.area_slug].filter(Boolean).join(" · ").replace(/-/g, " ")}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold">Profile</h2>
        <ProfileForm
          displayName={profile.data?.display_name ?? ""}
          phone={profile.data?.phone ?? user.phone ?? ""}
          preferredLang={profile.data?.preferred_lang ?? "en"}
        />
      </section>
    </div>
  );
}
