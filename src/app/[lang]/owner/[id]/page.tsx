import { listingPath } from "@/lib/paths";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DetailsForm, HoursEditor, PhotoManager, ServicesEditor } from "@/app/[lang]/owner/[id]/editors";
import {
  BookingSettingsForm,
  FeaturedRequest,
  LoyaltyEditor,
  PackagesEditor,
  PortfolioManager,
  PromotionsEditor,
  QuoteStatusButtons,
  ReviewReply,
  ServiceAreasEditor,
  StaffEditor,
  VoucherEditor,
} from "@/app/[lang]/owner/[id]/growth-editors";
import { TeamPhotosManager, VideoManager } from "@/app/[lang]/owner/[id]/media-editors";
import { ShopThemePicker } from "@/app/[lang]/owner/[id]/shop-theme";
import { Stars } from "@/components/shop/reviews-section";
import { RequestStatusButtons } from "@/components/request-status-buttons";
import { requireUser } from "@/lib/auth";
import { getAreas, getAttributes, getCategories, getMalls } from "@/lib/data/directory";
import { getFeatureSettings } from "@/lib/data/features";
import { getSiteSettings } from "@/lib/data/site-theme";
import { daysAgoIso, formatDate } from "@/lib/format";
import { malaysiaNow } from "@/lib/hours";
import { EVENT_TYPE_LABELS, QUOTE_STATUS_LABELS, type EventType } from "@/lib/labels";
import { paymentsEnabled } from "@/lib/setup";
import { createClient } from "@/lib/supabase/server";
import { normalizeTheme } from "@/lib/themes";
import type { Promotion, ServicePackage } from "@/lib/types";

export const metadata: Metadata = { title: "Manage your listing", robots: { index: false } };

const STATUS_LABELS: Record<string, string> = {
  sent: "New",
  confirmed: "Confirmed",
  declined: "Declined",
  no_show: "No-show",
  completed: "Completed",
};

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "profile", label: "Shop profile" },
  { id: "showcase", label: "Work, team & deals" },
  { id: "booking", label: "Booking" },
  { id: "grow", label: "Grow" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default function OwnerListingPage({ params, searchParams }: PageProps<"/[lang]/owner/[id]">) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Dashboard params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Dashboard({
  params,
  searchParams,
}: {
  params: PageProps<"/[lang]/owner/[id]">["params"];
  searchParams: PageProps<"/[lang]/owner/[id]">["searchParams"];
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.id === sp.tab) ? (sp.tab as Tab) : "overview";
  const user = await requireUser(`/owner/${id}`);
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("listing_members")
    .select("role")
    .eq("listing_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) notFound();

  const { data: l } = await supabase
    .from("listings")
    .select("id, slug, name, status, phone, description, website, instagram, facebook, price_level, gender, area_id, mall_id, video_path")
    .eq("id", id)
    .single();
  if (!l) notFound();

  return (
    <div className="space-y-8">
      {sp.welcome && (
        <p className="rounded-2xl bg-green-50 p-4 text-sm">
          You now manage <strong>{l.name}</strong> on BeautyBook. Add your menu and hours so customers can book.
        </p>
      )}
      {sp.paid === "featured" && (
        <p className="rounded-2xl bg-green-50 p-4 text-sm">Payment received. Your shop is featured for the next 30 days.</p>
      )}
      <div>
        <h1 className="text-2xl font-bold">{l.name}</h1>
        <p className="text-sm text-muted">
          {l.status === "active" ? (
            <Link href={listingPath(l.slug)} className="underline">View public page</Link>
          ) : (
            <>Not public yet ({l.status})</>
          )}
        </p>
      </div>
      <nav className="-mx-4 overflow-x-auto px-4" aria-label="Dashboard sections">
        <ul className="flex gap-1 border-b border-line text-sm">
          {TABS.map((t) => (
            <li key={t.id}>
              <Link
                href={`/owner/${id}?tab=${t.id}`}
                aria-current={tab === t.id ? "page" : undefined}
                className={`block whitespace-nowrap border-b-2 px-3 py-2 ${
                  tab === t.id ? "border-brand-600 font-semibold" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {tab === "overview" && <Overview listingId={id} />}
      {tab === "profile" && <Profile listing={l} />}
      {tab === "showcase" && <Showcase listingId={id} slug={l.slug} />}
      {tab === "booking" && <Booking listingId={id} slug={l.slug} />}
      {tab === "grow" && <Grow listingId={id} slug={l.slug} areaId={l.area_id} />}
    </div>
  );
}

// ---------------------------------------------------------------------------

const STAT_KINDS = [
  { kind: "view", label: "Page views" },
  { kind: "whatsapp", label: "WhatsApp taps" },
  { kind: "call", label: "Calls" },
  { kind: "request", label: "Booking & quote requests" },
  { kind: "directions", label: "Directions" },
  { kind: "website", label: "Website & social" },
] as const;

async function Overview({ listingId }: { listingId: string }) {
  const supabase = await createClient();
  const since = daysAgoIso(30);
  const [requests, quotes, stats] = await Promise.all([
    supabase
      .from("booking_requests")
      .select("id, short_code, service_name, staff_name, instant, preferred_at, customer_name, customer_phone, note, status, created_at")
      .eq("listing_id", listingId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("quote_requests")
      .select("id, package_name, event_type, event_date, people, location, budget, customer_name, customer_phone, note, status, created_at")
      .eq("listing_id", listingId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("listing_stats").select("day, kind, count").eq("listing_id", listingId).gte("day", since.slice(0, 10)),
  ]);
  const rows = stats.data ?? [];
  const total = (kind: string) => rows.filter((r) => r.kind === kind).reduce((s, r) => s + r.count, 0);
  const views = total("view");
  const contacts = total("whatsapp") + total("call") + total("request");
  // Daily page views for the last 30 days, oldest first.
  const days = Array.from({ length: 30 }, (_, i) => daysAgoIso(29 - i).slice(0, 10));
  const daily = days.map((d) => rows.filter((r) => r.kind === "view" && r.day === d).reduce((s, r) => s + r.count, 0));
  const peak = Math.max(1, ...daily);

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-lg font-semibold">Last 30 days</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {STAT_KINDS.map((s) => (
            <div key={s.kind} className="rounded-2xl border border-line bg-white p-4">
              <dt className="text-xs text-muted">{s.label}</dt>
              <dd className="text-2xl font-bold">{total(s.kind)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-sm text-muted">
          {views > 0
            ? `${Math.round((contacts / views) * 100)}% of visitors contacted you or sent a request.`
            : "Numbers appear as people visit your page."}
        </p>
        <svg viewBox="0 0 300 60" className="mt-3 h-20 w-full" role="img" aria-label="Page views per day, last 30 days">
          {daily.map((v, i) => (
            <rect
              key={days[i]}
              x={i * 10 + 1}
              y={60 - (v / peak) * 56}
              width={8}
              height={Math.max((v / peak) * 56, v ? 2 : 0.5)}
              rx={1.5}
              className="fill-brand-600"
            >
              <title>{`${days[i]}: ${v} views`}</title>
            </rect>
          ))}
        </svg>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Booking requests</h2>
        {requests.data?.length ? (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">
            {requests.data.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium">
                    {r.customer_name} · {r.service_name}
                    {r.staff_name ? ` · with ${r.staff_name}` : ""}
                    {r.instant && <span className="ml-2 rounded-full bg-green-50 px-2 text-xs text-whatsapp">Booked online</span>}
                  </p>
                  <p className="text-sm text-muted">
                    {r.preferred_at ? `For ${formatDate(r.preferred_at)}` : "Any time"} · sent {formatDate(r.created_at)} ·{" "}
                    {STATUS_LABELS[r.status]}
                    {r.customer_phone ? ` · +${r.customer_phone}` : ""}
                  </p>
                  {r.note && <p className="text-sm">“{r.note}”</p>}
                </div>
                <RequestStatusButtons id={r.id} status={r.status} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-muted">No requests yet. They appear here as soon as a customer sends one.</p>
        )}
      </section>

      {(quotes.data?.length ?? 0) > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Quote requests</h2>
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">
            {quotes.data!.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {q.customer_name} · {q.package_name ?? "Custom quote"}
                  </p>
                  <p className="text-muted">
                    {EVENT_TYPE_LABELS[q.event_type as EventType]}
                    {q.event_date ? ` · ${formatDate(q.event_date)}` : ""}
                    {q.people ? ` · ${q.people} people` : ""}
                    {q.budget ? ` · budget ${q.budget}` : ""}
                    {q.customer_phone ? ` · +${q.customer_phone}` : ""} · {QUOTE_STATUS_LABELS[q.status]}
                  </p>
                  {q.location && <p>Where: {q.location}</p>}
                  {q.note && <p>“{q.note}”</p>}
                </div>
                <QuoteStatusButtons listingId={listingId} id={q.id} status={q.status} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

type ListingRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  description: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  price_level: number | null;
  gender: string | null;
  mall_id: number | null;
  video_path: string | null;
};

async function Profile({ listing: l }: { listing: ListingRow }) {
  const supabase = await createClient();
  const [services, hours, closures, photos, attrs, serviceAreas, allAttributes, areas, settings, malls] = await Promise.all([
    supabase.from("services").select("name, price_from, price_to, duration_min").eq("listing_id", l.id).order("sort_order"),
    supabase.from("opening_hours").select("weekday, opens, closes").eq("listing_id", l.id),
    supabase.from("closures").select("date_from, date_to, note").eq("listing_id", l.id).order("date_from"),
    supabase.from("photos").select("id, storage_path, status").eq("listing_id", l.id).eq("kind", "shop").order("sort_order").order("id"),
    supabase.from("listing_attributes").select("attribute_id").eq("listing_id", l.id),
    supabase.from("listing_service_areas").select("area_id").eq("listing_id", l.id),
    getAttributes(),
    getAreas(),
    getSiteSettings(),
    getMalls(),
  ]);
  const homeService = allAttributes.find((a) => a.slug === "home-service");
  const isMobile = !!homeService && (attrs.data ?? []).some((a) => a.attribute_id === homeService.id);
  // Read with the owner's session: the public read can't see a listing that isn't live yet.
  const ownTheme = settings.ownerThemes
    ? (await supabase.from("listings").select("theme_style, theme_color").eq("id", l.id).single()).data
    : null;
  const shopTheme = ownTheme?.theme_style ? normalizeTheme(ownTheme.theme_style, ownTheme.theme_color) : null;

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-lg font-semibold">Details</h2>
        <DetailsForm
          listing={l}
          malls={malls}
          attributes={allAttributes}
          selectedAttributes={(attrs.data ?? []).map((a) => a.attribute_id)}
        />
        <p className="mt-2 text-sm text-muted">
          To change the shop name, address or phone number,{" "}
          <Link href={`${listingPath(l.slug)}/report`} className="underline">send us a correction</Link>.
        </p>
      </section>

      {(isMobile || (serviceAreas.data?.length ?? 0) > 0) && (
        <section>
          <h2 className="text-lg font-semibold">Areas you travel to</h2>
          <ServiceAreasEditor
            listingId={l.id}
            slug={l.slug}
            areas={areas}
            selected={(serviceAreas.data ?? []).map((a) => a.area_id)}
          />
        </section>
      )}
      {!isMobile && (serviceAreas.data?.length ?? 0) === 0 && (
        <p className="text-sm text-muted">
          Do you go to customers&apos; homes or venues? Tick “Home service” above and save, then pick the areas you cover.
        </p>
      )}

      <section>
        <h2 className="text-lg font-semibold">Service menu</h2>
        <ServicesEditor listingId={l.id} slug={l.slug} initial={services.data ?? []} />
      </section>

      <section>
        <h2 className="text-lg font-semibold">Opening hours</h2>
        <HoursEditor listingId={l.id} slug={l.slug} initialHours={hours.data ?? []} initialClosures={closures.data ?? []} />
      </section>

      <section>
        <h2 className="text-lg font-semibold">Shop photos</h2>
        <p className="text-sm text-muted">Pick one as your profile photo. Customers see it first.</p>
        <PhotoManager listingId={l.id} slug={l.slug} photos={photos.data ?? []} />
      </section>

      <section>
        <h2 className="text-lg font-semibold">Shop video</h2>
        <VideoManager listingId={l.id} slug={l.slug} videoPath={l.video_path} />
      </section>

      {settings.ownerThemes && (
        <section>
          <h2 className="text-lg font-semibold">Shop page theme</h2>
          <p className="text-sm text-muted">Give your shop page its own style and colour.</p>
          <ShopThemePicker listingId={l.id} slug={l.slug} current={shopTheme} siteTheme={settings.theme} />
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

async function Showcase({ listingId, slug }: { listingId: string; slug: string }) {
  const supabase = await createClient();
  const [portfolio, staff, promotions, packages, categories, teamPhotos] = await Promise.all([
    supabase
      .from("photos")
      .select("id, storage_path, caption, category_id")
      .eq("listing_id", listingId)
      .eq("kind", "portfolio")
      .order("sort_order"),
    supabase.from("shop_staff").select("id, name, title, bio, photo_path, languages").eq("listing_id", listingId).order("sort_order"),
    supabase
      .from("promotions")
      .select("id, title, details, price_label, occasion, starts_on, ends_on")
      .eq("listing_id", listingId)
      .order("ends_on", { ascending: false })
      .limit(20),
    supabase
      .from("packages")
      .select("id, kind, name, description, includes, price_from, price_to")
      .eq("listing_id", listingId)
      .order("sort_order"),
    getCategories(),
    supabase.from("photos").select("id, storage_path").eq("listing_id", listingId).eq("kind", "team").order("sort_order"),
  ]);
  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-lg font-semibold">Portfolio</h2>
        <PortfolioManager listingId={listingId} slug={slug} photos={portfolio.data ?? []} categories={categories} />
      </section>
      <section>
        <h2 className="text-lg font-semibold">Team</h2>
        <TeamPhotosManager listingId={listingId} slug={slug} photos={teamPhotos.data ?? []} />
        <StaffEditor listingId={listingId} slug={slug} initial={staff.data ?? []} />
      </section>
      <section>
        <h2 className="text-lg font-semibold">Deals and promotions</h2>
        <PromotionsEditor
          listingId={listingId}
          slug={slug}
          promotions={(promotions.data ?? []) as Promotion[]}
          today={malaysiaNow().date}
        />
      </section>
      <section>
        <h2 className="text-lg font-semibold">Bridal and event packages</h2>
        <PackagesEditor
          listingId={listingId}
          slug={slug}
          initial={((packages.data ?? []) as ServicePackage[]).map((p) => ({
            ...p,
            price_from: p.price_from === null ? null : Number(p.price_from),
            price_to: p.price_to === null ? null : Number(p.price_to),
          }))}
        />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------

async function Booking({ listingId, slug }: { listingId: string; slug: string }) {
  const supabase = await createClient();
  const [settings, hours] = await Promise.all([
    supabase
      .from("booking_settings")
      .select("instant_enabled, slot_minutes, capacity, min_notice_hours, max_days_ahead")
      .eq("listing_id", listingId)
      .maybeSingle(),
    supabase.from("opening_hours").select("id", { count: "exact", head: true }).eq("listing_id", listingId),
  ]);
  return (
    <section>
      <h2 className="text-lg font-semibold">Online booking</h2>
      <BookingSettingsForm listingId={listingId} slug={slug} initial={settings.data} hasHours={(hours.count ?? 0) > 0} />
    </section>
  );
}

// ---------------------------------------------------------------------------

async function Grow({ listingId, slug, areaId }: { listingId: string; slug: string; areaId: number | null }) {
  const supabase = await createClient();
  const [features, featured, reviews, loyalty, vouchers, voucherSales, areas, categories] = await Promise.all([
    getFeatureSettings(),
    supabase
      .from("featured_placements")
      .select("id, status, starts_at, ends_at, area_id, category_id")
      .eq("listing_id", listingId)
      .in("status", ["requested", "active"])
      .order("ends_at", { ascending: false }),
    supabase
      .from("reviews")
      .select("id, author_name, rating, body, service_name, owner_reply, created_at")
      .eq("listing_id", listingId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("loyalty_programs").select("enabled, stamps_required, reward").eq("listing_id", listingId).maybeSingle(),
    supabase.from("voucher_settings").select("enabled, amounts, valid_months, terms").eq("listing_id", listingId).maybeSingle(),
    supabase
      .from("gift_vouchers")
      .select("id, amount_rm, recipient_name, status, created_at, expires_at")
      .eq("listing_id", listingId)
      .neq("status", "pending_payment")
      .order("created_at", { ascending: false })
      .limit(20),
    getAreas(),
    getCategories(),
  ]);
  const now = new Date().toISOString();
  const live = (featured.data ?? []).filter((f) => f.status === "active" && f.ends_at > now);
  const waiting = (featured.data ?? []).filter((f) => f.status === "requested");
  const areaName = (aid: number | null) => areas.find((a) => a.id === aid)?.name ?? "All of Klang Valley";
  const pay = paymentsEnabled();

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-lg font-semibold">Featured placement</h2>
        {live.map((f) => (
          <p key={f.id} className="mt-2 rounded-xl bg-green-50 p-3 text-sm">
            Featured in {areaName(f.area_id)} until {formatDate(f.ends_at)}.
          </p>
        ))}
        {waiting.length > 0 && (
          <p className="mt-2 rounded-xl bg-canvas p-3 text-sm">Your request is with the BeautyBook team. We&apos;ll be in touch.</p>
        )}
        {waiting.length === 0 && (
          <FeaturedRequest
            listingId={listingId}
            areas={areas.filter((a) => a.type !== "state")}
            categories={categories}
            defaultAreaId={areaId}
            priceRm={features.featuredPriceRm}
            paymentsReady={pay}
          />
        )}
      </section>

      {features.reviewsEnabled && (
        <section>
          <h2 className="text-lg font-semibold">Reviews</h2>
          {reviews.data?.length ? (
            <ul className="mt-3 space-y-3">
              {reviews.data.map((r) => (
                <li key={r.id} className="rounded-2xl border border-line bg-white p-4 text-sm">
                  <p>
                    <Stars value={r.rating} /> <strong>{r.author_name}</strong>
                    <span className="text-muted">
                      {" "}
                      · {r.service_name} · {formatDate(r.created_at)}
                    </span>
                  </p>
                  {r.body && <p className="mt-1">{r.body}</p>}
                  <ReviewReply listingId={listingId} reviewId={r.id} reply={r.owner_reply} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">
              Customers can review you after you mark their booking “Completed”.
            </p>
          )}
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold">Stamp card</h2>
        <LoyaltyEditor listingId={listingId} slug={slug} initial={loyalty.data} />
      </section>

      <section>
        <h2 className="text-lg font-semibold">Gift vouchers</h2>
        <VoucherEditor listingId={listingId} slug={slug} initial={vouchers.data} paymentsReady={pay} />
        {(voucherSales.data?.length ?? 0) > 0 && (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white text-sm">
            {voucherSales.data!.map((v) => (
              <li key={v.id} className="flex justify-between p-3">
                <span>
                  RM{v.amount_rm} for {v.recipient_name}
                </span>
                <span className="text-muted">
                  {v.status === "active" ? `valid until ${formatDate(v.expires_at)}` : v.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
