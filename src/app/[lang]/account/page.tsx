import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProfileForm } from "@/app/[lang]/account/profile-form";
import { clearSearchHistory } from "@/app/[lang]/account/actions";
import { InviteLink } from "@/app/[lang]/account/invite-link";
import { requireUser } from "@/lib/auth";
import { getCategories } from "@/lib/data/directory";
import { getFeatureSettings } from "@/lib/data/features";
import { formatDate } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { listingPath } from "@/lib/paths";
import { remindersEnabled } from "@/lib/setup";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.account.metaTitle, robots: { index: false } };
}

export default async function AccountPage() {
  const { t } = await getI18n();
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
        <Account />
      </Suspense>
    </div>
  );
}

type ListingRef = { id: string; slug: string; name: string } | null;
type CategoryRef = { listing_categories: { is_primary: boolean; category_id: number }[] };

// The time of this request. The page is per-user and dynamic, never cached.
async function requestTime(): Promise<number> {
  return Date.now();
}

// "Book again" link that preselects the same service and stylist.
function bookAgainHref(slug: string, serviceId: number | null, staffId: number | null): string {
  const qs = new URLSearchParams();
  if (serviceId) qs.set("service", String(serviceId));
  if (staffId) qs.set("staff", String(staffId));
  const q = qs.toString();
  return `${listingPath(slug)}${q ? `?${q}` : ""}#book`;
}

async function Account() {
  const [user, { locale, t, href }] = await Promise.all([requireUser("/account"), getI18n()]);
  const a = t.account;
  const g = t.growth.account;
  const statuses: Record<string, string> = a.statuses;
  const supabase = await createClient();
  const [profile, requests, favourites, notes, searches, memberships, stamps, redemptions, points, referrals, vouchers, myReviews, features, categories] =
    await Promise.all([
      supabase.from("profiles").select("display_name, phone, preferred_lang, reminders_opt_in, referral_code").eq("id", user.id).maybeSingle(),
      supabase
        .from("booking_requests")
        .select(
          "id, service_id, service_name, staff_id, staff_name, preferred_at, status, created_at, listings ( id, slug, name, listing_categories ( is_primary, category_id ) )",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("favourites").select("created_at, listings ( id, slug, name )").order("created_at", { ascending: false }),
      supabase.from("notes").select("body, updated_at, listings ( id, slug, name )").order("updated_at", { ascending: false }),
      supabase.from("search_history").select("id, query, category_slug, area_slug, created_at").order("created_at", { ascending: false }).limit(10),
      supabase.from("listing_members").select("listing_id").eq("user_id", user.id).limit(1),
      supabase.from("loyalty_stamps").select("listing_id, listings ( slug, name, loyalty_programs ( enabled, stamps_required, reward ) )").eq("user_id", user.id),
      supabase.from("loyalty_redemptions").select("listing_id, stamps_used").eq("user_id", user.id),
      supabase.from("reward_points").select("points").eq("user_id", user.id),
      supabase.from("referrals").select("referred_id, rewarded_at").eq("referrer_id", user.id),
      supabase
        .from("gift_vouchers")
        .select("id, amount_rm, recipient_name, status, expires_at, listings ( slug, name )")
        .eq("buyer_id", user.id)
        .neq("status", "pending_payment")
        .order("created_at", { ascending: false }),
      supabase.from("reviews").select("booking_request_id").eq("user_id", user.id),
      getFeatureSettings(),
      getCategories(),
    ]);
  const ref = (x: unknown) => (x as { listings: ListingRef }).listings;
  const allRequests = requests.data ?? [];

  // Shops visited, newest first, one entry per shop.
  const visited = new Map<string, (typeof allRequests)[number]>();
  for (const r of allRequests) {
    const l = ref(r);
    if (l && (r.status === "completed" || r.status === "confirmed") && !visited.has(l.id)) visited.set(l.id, r);
  }

  // "Time for a touch-up": a completed visit older than the category's usual gap.
  const now = await requestTime();
  const touchUps = [...visited.values()].flatMap((r) => {
    if (r.status !== "completed") return [];
    const cats = (r.listings as unknown as CategoryRef | null)?.listing_categories ?? [];
    const primary = cats.find((c) => c.is_primary) ?? cats[0];
    const days = categories.find((c) => c.id === primary?.category_id)?.rebook_days;
    const at = new Date(r.preferred_at ?? r.created_at).getTime();
    return days && now - at > days * 86_400_000 ? [{ r, weeks: Math.round((now - at) / (7 * 86_400_000)) }] : [];
  });

  const reviewed = new Set((myReviews.data ?? []).map((r) => r.booking_request_id));
  const toReview = features.reviewsEnabled
    ? allRequests.filter(
        (r) =>
          !reviewed.has(r.id) &&
          (r.status === "completed" || (r.status === "confirmed" && r.preferred_at && new Date(r.preferred_at).getTime() < now)),
      )
    : [];

  // Stamp cards: stamps earned minus stamps used, per shop.
  const cards = new Map<string, { slug: string; name: string; required: number; reward: string; stamps: number }>();
  for (const s of stamps.data ?? []) {
    const l = s.listings as unknown as {
      slug: string;
      name: string;
      loyalty_programs: { enabled: boolean; stamps_required: number; reward: string } | null;
    } | null;
    if (!l?.loyalty_programs) continue;
    const card = cards.get(s.listing_id) ?? {
      slug: l.slug,
      name: l.name,
      required: l.loyalty_programs.stamps_required,
      reward: l.loyalty_programs.reward,
      stamps: 0,
    };
    card.stamps += 1;
    cards.set(s.listing_id, card);
  }
  for (const r of redemptions.data ?? []) {
    const card = cards.get(r.listing_id);
    if (card) card.stamps -= r.stamps_used;
  }
  const totalPoints = (points.data ?? []).reduce((s, p) => s + p.points, 0);
  const code = profile.data?.referral_code ?? "";

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">
          {profile.data?.display_name ? fmt(a.hiName, { name: profile.data.display_name }) : a.hi}
        </h1>
        <div className="flex gap-2">
          {(memberships.data?.length ?? 0) > 0 && (
            <Link href={href("/owner")} className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white">
              {a.myBusiness}
            </Link>
          )}
          <form action="/auth/signout" method="post">
            <button className="rounded-full border border-line bg-white px-4 py-2 text-sm">{t.common.signOut}</button>
          </form>
        </div>
      </div>

      {touchUps.length > 0 && (
        <section className="rounded-2xl bg-brand-50 p-5">
          <h2 className="text-lg font-semibold">{g.touchUp}</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {touchUps.map(({ r, weeks }) => {
              const l = ref(r)!;
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {fmt(g.touchUpBody, { weeks, service: r.service_name.toLowerCase(), shop: l.name })}
                  </span>
                  <Link href={href(bookAgainHref(l.slug, r.service_id, r.staff_id))} className="rounded-full bg-ink px-3 py-1 text-white">
                    {a.bookAgain}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {toReview.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">{g.reviewVisits}</h2>
          <ul className="mt-3 flex flex-wrap gap-2 text-sm">
            {toReview.slice(0, 6).map((r) => (
              <li key={r.id}>
                <Link href={href(`/account/review/${r.id}`)} className="inline-block rounded-full border border-line bg-white px-3 py-1.5 hover:border-brand-200">
                  ★ {ref(r)?.name} · {r.service_name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {visited.size > 0 && (
        <section>
          <h2 className="text-lg font-semibold">{a.bookAgain}</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {[...visited.values()].map((r) => {
              const l = ref(r)!;
              return (
                <li key={l.id} className="flex items-center justify-between gap-2 rounded-xl border border-line bg-white p-3 text-sm">
                  <span className="min-w-0">
                    <span className="block font-medium">{l.name}</span>
                    <span className="text-muted">
                      {r.service_name}
                      {r.staff_name ? ` ${fmt(g.withStaff, { name: r.staff_name })}` : ""}
                    </span>
                  </span>
                  <Link href={href(bookAgainHref(l.slug, r.service_id, r.staff_id))} className="shrink-0 rounded-full bg-ink px-3 py-1 text-white">
                    {a.bookAgain}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold">{a.requests}</h2>
        {allRequests.length ? (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">
            {allRequests.slice(0, 30).map((r) => {
              const listing = ref(r);
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <div>
                    <p className="font-medium">{listing?.name ?? a.shopRemoved}</p>
                    <p className="text-sm text-muted">
                      {r.service_name}
                      {r.staff_name ? ` ${fmt(g.withStaff, { name: r.staff_name })}` : ""}
                      {r.preferred_at ? ` · ${formatDate(r.preferred_at, locale)}` : ""} · {statuses[r.status] ?? r.status}
                    </p>
                  </div>
                  {listing && (
                    <Link
                      href={href(bookAgainHref(listing.slug, r.service_id, r.staff_id))}
                      className="rounded-full border border-line px-3 py-1 text-sm hover:border-brand-200"
                    >
                      {a.bookAgain}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-muted">
            {a.noRequests} <Link href={href("/search")} className="underline">{a.findShop}</Link>.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">{a.savedShops}</h2>
        {favourites.data?.length ? (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {favourites.data.map((f) => {
              const listing = ref(f);
              return listing ? (
                <li key={listing.slug} className="flex items-center justify-between gap-2 rounded-xl border border-line bg-white p-3 text-sm">
                  <Link href={href(listingPath(listing.slug))} className="font-medium hover:underline">{listing.name}</Link>
                  <Link href={href(`${listingPath(listing.slug)}#book`)} className="shrink-0 rounded-full border border-line px-3 py-1 hover:border-brand-200">
                    {g.book}
                  </Link>
                </li>
              ) : null;
            })}
          </ul>
        ) : (
          <p className="mt-2 text-muted">{a.noSaved}</p>
        )}
      </section>

      {cards.size > 0 && (
        <section>
          <h2 className="text-lg font-semibold">{g.stampCards}</h2>
          <p className="text-sm text-muted">
            {g.showCode} <strong className="font-mono text-ink">{code}</strong>
          </p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {[...cards.values()].map((c) => (
              <li key={c.slug} className="rounded-2xl border border-dashed border-brand-200 bg-white p-4 text-sm">
                <Link href={href(listingPath(c.slug))} className="font-semibold hover:underline">{c.name}</Link>
                <div className="mt-2 flex flex-wrap gap-1" aria-label={fmt(g.stampsOf, { count: Math.min(c.stamps, c.required), total: c.required })}>
                  {Array.from({ length: c.required }, (_, i) => (
                    <span
                      key={i}
                      className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                        i < c.stamps ? "border-brand-600 bg-brand-600 text-white" : "border-line"
                      }`}
                    >
                      {i < c.stamps ? "✓" : ""}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-muted">
                  {c.stamps >= c.required ? (
                    <strong className="text-ink">{fmt(g.rewardReady, { reward: c.reward })}</strong>
                  ) : (
                    fmt(g.moreFor, { count: c.required - c.stamps, reward: c.reward })
                  )}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold">{g.invite}</h2>
        <p className="mt-1 text-sm text-muted">
          {fmt(g.inviteBody, { points: features.referralPoints, theirs: Math.floor(features.referralPoints / 2) })}
        </p>
        {code && <InviteLink code={code} />}
        <p className="mt-2 text-sm">
          {g.yourPoints} <strong>{totalPoints}</strong>
          {(referrals.data?.length ?? 0) > 0 && (
            <span className="text-muted">
              {" "}
              ·{" "}
              {fmt(g.friends, {
                joined: referrals.data!.length,
                visited: referrals.data!.filter((r) => r.rewarded_at).length,
              })}
            </span>
          )}
        </p>
      </section>

      {(vouchers.data?.length ?? 0) > 0 && (
        <section>
          <h2 className="text-lg font-semibold">{g.vouchers}</h2>
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white text-sm">
            {vouchers.data!.map((v) => (
              <li key={v.id} className="flex justify-between p-3">
                <Link href={href(`/account/vouchers/${v.id}`)} className="hover:underline">
                  {fmt(g.voucherLine, {
                    amount: `RM${v.amount_rm}`,
                    shop: (v.listings as unknown as { name: string } | null)?.name ?? "",
                    name: v.recipient_name,
                  })}
                </Link>
                <span className="text-muted">{v.status === "active" ? fmt(g.until, { date: formatDate(v.expires_at, locale) }) : (g.voucherStatus as Record<string, string>)[v.status] ?? v.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {notes.data && notes.data.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">{a.myNotes}</h2>
          <ul className="mt-3 space-y-2">
            {notes.data.map((n) => {
              const listing = ref(n);
              return listing ? (
                <li key={listing.slug} className="rounded-xl border border-line bg-white p-3">
                  <Link href={href(listingPath(listing.slug))} className="font-medium hover:underline">{listing.name}</Link>
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
            <h2 className="text-lg font-semibold">{a.history}</h2>
            <form action={clearSearchHistory}>
              <button className="text-sm text-muted underline">{a.clear}</button>
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
                  <Link href={href(`/search?${qs}`)} className="inline-block rounded-full bg-white px-3 py-1 hover:bg-brand-50">
                    {[s.query, s.category_slug, s.area_slug].filter(Boolean).join(" · ").replace(/-/g, " ")}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold">{a.profile}</h2>
        <ProfileForm
          displayName={profile.data?.display_name ?? ""}
          phone={profile.data?.phone ?? user.phone ?? ""}
          preferredLang={profile.data?.preferred_lang ?? locale}
          remindersOptIn={profile.data?.reminders_opt_in ?? false}
          remindersAvailable={remindersEnabled()}
        />
      </section>
    </div>
  );
}
