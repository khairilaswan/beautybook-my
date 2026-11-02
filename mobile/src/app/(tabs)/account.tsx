import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Share, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Card, Chip, Empty, ErrorView, Field, Loading, Notice, Screen, Section, styles } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { getTaxonomy } from "@/lib/data";
import { confirmDeleteAccount } from "@/lib/delete-account";
import { formatDate } from "@/lib/format";
import { fmt, useI18n } from "@/lib/i18n";
import { LOCALES, LOCALE_NAMES, type Locale, isLocale } from "@/lib/i18n/config";
import { openWebPage, webPath } from "@/lib/links";
import { normalizeMalaysianPhone } from "@/lib/phone";
import { supabase } from "@/lib/supabase";
import { colors, radius, space } from "@/lib/theme";
import { useAsync } from "@/lib/use-async";

type ListingRef = { id: string; slug: string; name: string; listing_categories?: { is_primary: boolean; category_id: number }[] } | null;
type RequestRow = {
  id: string;
  service_id: number | null;
  service_name: string;
  staff_id: number | null;
  staff_name: string | null;
  preferred_at: string | null;
  status: string;
  created_at: string;
  listings: ListingRef;
};

// "Book again" with the same service and stylist preselected.
function bookAgain(slug: string, serviceId: number | null, staffId: number | null) {
  router.push({
    pathname: "/book/[slug]",
    params: { slug, ...(serviceId ? { service: String(serviceId) } : {}), ...(staffId ? { staff: String(staffId) } : {}) },
  });
}

export default function Account() {
  const { t, locale, setLocale } = useI18n();
  const { userId, session, config, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const a = t.account;

  const { data, error, loading, reload } = useAsync(
    async () => {
      if (!userId) return null;
      const [profile, requests, quotes, memberships, stamps, redemptions, points, referrals, vouchers, myReviews, searches, taxonomy] =
        await Promise.all([
          supabase.from("profiles").select("display_name, phone, preferred_lang, reminders_opt_in, referral_code").eq("id", userId).maybeSingle(),
          supabase
            .from("booking_requests")
            .select(
              "id, service_id, service_name, staff_id, staff_name, preferred_at, status, created_at, listings ( id, slug, name, listing_categories ( is_primary, category_id ) )",
            )
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("quote_requests")
            .select("id, package_name, event_type, event_date, status, created_at, listings ( id, slug, name )")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(20),
          supabase.from("listing_members").select("listing_id").eq("user_id", userId).limit(1),
          supabase.from("loyalty_stamps").select("listing_id, listings ( slug, name, loyalty_programs ( enabled, stamps_required, reward ) )").eq("user_id", userId),
          supabase.from("loyalty_redemptions").select("listing_id, stamps_used").eq("user_id", userId),
          supabase.from("reward_points").select("points").eq("user_id", userId),
          supabase.from("referrals").select("referred_id, rewarded_at").eq("referrer_id", userId),
          supabase
            .from("gift_vouchers")
            .select("id, amount_rm, recipient_name, status, expires_at, listings ( slug, name )")
            .eq("buyer_id", userId)
            .neq("status", "pending_payment")
            .order("created_at", { ascending: false }),
          supabase.from("reviews").select("booking_request_id").eq("user_id", userId),
          supabase.from("search_history").select("id, query, category_slug, area_slug").order("created_at", { ascending: false }).limit(10),
          getTaxonomy(),
        ]);
      if (requests.error) throw requests.error;
      return {
        now: Date.now(),
        profile: profile.data,
        requests: (requests.data ?? []) as unknown as RequestRow[],
        quotes: (quotes.data ?? []) as unknown as {
          id: string;
          package_name: string | null;
          event_type: keyof typeof t.quote.eventTypes;
          event_date: string | null;
          status: string;
          listings: ListingRef;
        }[],
        isOwner: (memberships.data?.length ?? 0) > 0,
        stamps: (stamps.data ?? []) as unknown as {
          listing_id: string;
          listings: { slug: string; name: string; loyalty_programs: { enabled: boolean; stamps_required: number; reward: string } | null } | null;
        }[],
        redemptions: redemptions.data ?? [],
        points: (points.data ?? []).reduce((s, p) => s + (p.points as number), 0),
        referrals: referrals.data ?? [],
        vouchers: (vouchers.data ?? []) as unknown as {
          id: number;
          amount_rm: number;
          recipient_name: string;
          status: keyof typeof t.account.voucherStatus;
          expires_at: string;
          listings: { slug: string; name: string } | null;
        }[],
        reviewed: new Set((myReviews.data ?? []).map((r) => r.booking_request_id as string)),
        searches: (searches.data ?? []) as { id: number; query: string | null; category_slug: string | null; area_slug: string | null }[],
        categories: taxonomy.categories,
      };
    },
    [userId],
    { refetchOnFocus: true },
  );

  const top = { paddingTop: insets.top + space(4) };
  if (!userId) {
    return (
      <Screen contentStyle={top}>
        <Text style={styles.h1}>{t.tabs.account}</Text>
        <Empty title={t.login.lead}>
          <Button title={t.login.signIn} onPress={() => router.push("/login")} style={{ marginTop: space(4) }} />
        </Empty>
        <LanguagePicker locale={locale} onChange={setLocale} />
      </Screen>
    );
  }
  if (!data && loading) return <Loading />;
  if (!data) return <ErrorView onRetry={reload} />;

  const now = data.now;
  const ref = (r: { listings: ListingRef }) => r.listings;

  // Shops visited, newest first, one entry per shop.
  const visited = new Map<string, RequestRow>();
  for (const r of data.requests) {
    const l = ref(r);
    if (l && (r.status === "completed" || r.status === "confirmed") && !visited.has(l.id)) visited.set(l.id, r);
  }

  // "Time for a touch-up": a completed visit older than the category's usual gap.
  const touchUps = [...visited.values()].flatMap((r) => {
    if (r.status !== "completed") return [];
    const cats = r.listings?.listing_categories ?? [];
    const primary = cats.find((c) => c.is_primary) ?? cats[0];
    const days = data.categories.find((c) => c.id === primary?.category_id)?.rebook_days;
    const at = new Date(r.preferred_at ?? r.created_at).getTime();
    return days && now - at > days * 86_400_000 ? [{ r, weeks: Math.round((now - at) / (7 * 86_400_000)) }] : [];
  });

  const toReview = config.reviewsEnabled
    ? data.requests.filter(
        (r) =>
          !data.reviewed.has(r.id) &&
          (r.status === "completed" || (r.status === "confirmed" && r.preferred_at && new Date(r.preferred_at).getTime() < now)),
      )
    : [];

  // Stamp cards: stamps earned minus stamps used, per shop.
  const cards = new Map<string, { slug: string; name: string; required: number; reward: string; stamps: number }>();
  for (const s of data.stamps) {
    const l = s.listings;
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
  for (const r of data.redemptions) {
    const card = cards.get(r.listing_id as string);
    if (card) card.stamps -= r.stamps_used as number;
  }

  const code = (data.profile?.referral_code as string | undefined) ?? "";
  const inviteUrl = `${config.siteUrl}${webPath(locale, `/invite/${code}`)}`;
  const open = (slug: string) => router.push({ pathname: "/salon/[slug]", params: { slug } });
  const statuses: Record<string, string> = a.statuses;
  const quoteStatuses: Record<string, string> = a.quoteStatuses;

  return (
    <Screen refreshing={loading} onRefresh={reload} contentStyle={top}>
      {error ? <Notice text={t.common.offline} tone="error" /> : null}
      <Text style={styles.h1} accessibilityRole="header">
        {data.profile?.display_name ? fmt(a.hiName, { name: data.profile.display_name as string }) : a.hi}
      </Text>

      {data.isOwner ? <Button title={a.myBusiness} variant="brand" onPress={() => router.push("/owner")} /> : null}

      {touchUps.length > 0 ? (
        <View style={{ backgroundColor: colors.brand50, borderRadius: radius.lg, padding: space(4), gap: space(2) }}>
          <Text style={styles.h3}>{a.touchUp}</Text>
          {touchUps.map(({ r, weeks }) => (
            <View key={r.id} style={{ gap: space(2) }}>
              <Text style={styles.body}>
                {fmt(a.touchUpBody, { weeks, service: r.service_name.toLowerCase(), shop: r.listings!.name })}
              </Text>
              <Button title={a.bookAgain} small style={{ alignSelf: "flex-start" }} onPress={() => bookAgain(r.listings!.slug, r.service_id, r.staff_id)} />
            </View>
          ))}
        </View>
      ) : null}

      {toReview.length > 0 ? (
        <Section title={a.reviewVisits}>
          <View style={styles.wrap}>
            {toReview.slice(0, 6).map((r) => (
              <Chip
                key={r.id}
                label={`★ ${r.listings?.name ?? ""} · ${r.service_name}`}
                onPress={() => router.push({ pathname: "/review/[id]", params: { id: r.id } })}
              />
            ))}
          </View>
        </Section>
      ) : null}

      {visited.size > 0 ? (
        <Section title={a.bookAgain}>
          {[...visited.values()].map((r) => (
            <Card key={r.listings!.id} style={{ flexDirection: "row", alignItems: "center", gap: space(2) }}>
              <Pressable style={{ flex: 1 }} onPress={() => open(r.listings!.slug)}>
                <Text style={styles.h3}>{r.listings!.name}</Text>
                <Text style={styles.muted}>
                  {r.service_name}
                  {r.staff_name ? ` ${fmt(a.withStaff, { name: r.staff_name })}` : ""}
                </Text>
              </Pressable>
              <Button title={a.bookAgain} small onPress={() => bookAgain(r.listings!.slug, r.service_id, r.staff_id)} />
            </Card>
          ))}
        </Section>
      ) : null}

      <Section title={a.requests}>
        {data.requests.length === 0 ? (
          <View style={{ gap: space(2) }}>
            <Text style={styles.muted}>{a.noRequests}</Text>
            <Button title={a.findShop} variant="outline" small style={{ alignSelf: "flex-start" }} onPress={() => router.navigate("/explore")} />
          </View>
        ) : (
          data.requests.slice(0, 30).map((r) => (
            <Card key={r.id} onPress={r.listings ? () => open(r.listings!.slug) : undefined}>
              <Text style={styles.h3}>{r.listings?.name ?? a.shopRemoved}</Text>
              <Text style={styles.muted}>
                {r.service_name}
                {r.staff_name ? ` ${fmt(a.withStaff, { name: r.staff_name })}` : ""}
                {r.preferred_at ? ` · ${formatDate(r.preferred_at, locale)}` : ""} · {statuses[r.status] ?? r.status}
              </Text>
            </Card>
          ))
        )}
      </Section>

      {data.quotes.length > 0 ? (
        <Section title={a.quotes}>
          {data.quotes.map((q) => (
            <Card key={q.id} onPress={q.listings ? () => open(q.listings!.slug) : undefined}>
              <Text style={styles.h3}>{q.listings?.name ?? a.shopRemoved}</Text>
              <Text style={styles.muted}>
                {[q.package_name, t.quote.eventTypes[q.event_type] ?? q.event_type, q.event_date ? formatDate(q.event_date, locale) : null, quoteStatuses[q.status] ?? q.status]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </Card>
          ))}
        </Section>
      ) : null}

      {cards.size > 0 ? (
        <Section title={a.stampCards}>
          <Text style={styles.muted}>
            {a.showCode} <Text style={{ fontWeight: "700", color: colors.ink }}>{code}</Text>
          </Text>
          {[...cards.values()].map((c) => (
            <Card key={c.slug} onPress={() => open(c.slug)} style={{ borderStyle: "dashed", borderColor: colors.brand200 }}>
              <Text style={styles.h3}>{c.name}</Text>
              <View style={[styles.wrap, { gap: space(1), marginVertical: space(1) }]}>
                {Array.from({ length: c.required }, (_, i) => (
                  <View
                    key={i}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      borderWidth: 1,
                      borderColor: i < c.stamps ? colors.brand600 : colors.line,
                      backgroundColor: i < c.stamps ? colors.brand600 : colors.white,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {i < c.stamps ? <Text style={{ color: colors.white, fontSize: 12 }}>✓</Text> : null}
                  </View>
                ))}
              </View>
              <Text style={styles.muted}>
                {c.stamps >= c.required ? fmt(a.rewardReady, { reward: c.reward }) : fmt(a.moreFor, { count: c.required - c.stamps, reward: c.reward })}
              </Text>
            </Card>
          ))}
        </Section>
      ) : null}

      {code ? (
        <Section title={a.invite}>
          <Text style={styles.muted}>
            {fmt(a.inviteBody, { points: config.referralPoints, theirs: Math.floor(config.referralPoints / 2) })}
          </Text>
          <Button
            title={a.shareInvite}
            variant="outline"
            onPress={() => Share.share({ message: fmt(a.inviteMessage, { url: inviteUrl }) }).catch(() => {})}
          />
          <Text style={styles.body}>
            {fmt(a.yourPoints, { points: data.points })}
            {data.referrals.length > 0
              ? ` · ${fmt(a.friends, { joined: data.referrals.length, visited: data.referrals.filter((r) => r.rewarded_at).length })}`
              : ""}
          </Text>
        </Section>
      ) : null}

      {data.vouchers.length > 0 ? (
        <Section title={a.vouchers}>
          {data.vouchers.map((v) => (
            <Card key={v.id} onPress={() => openWebPage(webPath(locale, `/account/vouchers/${v.id}`))}>
              <Text style={styles.body}>
                {fmt(a.voucherLine, { amount: `RM${v.amount_rm}`, shop: v.listings?.name ?? "", name: v.recipient_name })}
              </Text>
              <Text style={styles.muted}>
                {v.status === "active" ? fmt(a.until, { date: formatDate(v.expires_at, locale) }) : (a.voucherStatus[v.status] ?? v.status)}
              </Text>
            </Card>
          ))}
        </Section>
      ) : null}

      {data.searches.length > 0 ? (
        <Section
          title={a.history}
          right={
            <Pressable
              accessibilityRole="button"
              onPress={async () => {
                await supabase.from("search_history").delete().eq("user_id", userId);
                void reload();
              }}
            >
              <Text style={styles.link}>{t.common.clear}</Text>
            </Pressable>
          }
        >
          <View style={styles.wrap}>
            {data.searches.map((s) => (
              <Chip
                key={s.id}
                label={[s.query, s.category_slug, s.area_slug].filter(Boolean).join(" · ").replace(/-/g, " ")}
                onPress={() =>
                  router.navigate({
                    pathname: "/explore",
                    params: {
                      ...(s.query ? { q: s.query } : {}),
                      ...(s.category_slug ? { category: s.category_slug } : {}),
                      ...(s.area_slug ? { area: s.area_slug } : {}),
                    },
                  })
                }
              />
            ))}
          </View>
        </Section>
      ) : null}

      <ProfileForm
        key={`${data.profile?.display_name ?? ""}|${data.profile?.phone ?? ""}|${!!data.profile?.reminders_opt_in}`}
        userId={userId}
        initialName={(data.profile?.display_name as string | null) ?? ""}
        initialPhone={(data.profile?.phone as string | null) ?? session?.user.phone ?? ""}
        initialReminders={!!data.profile?.reminders_opt_in}
        remindersAvailable={config.remindersEnabled}
        onSaved={reload}
      />

      <LanguagePicker
        locale={locale}
        onChange={(l) => {
          setLocale(l);
          void supabase.from("profiles").update({ preferred_lang: l }).eq("id", userId);
        }}
      />

      <View style={{ gap: space(2) }}>
        <Button title={a.privacy} variant="ghost" onPress={() => openWebPage(webPath(locale, "/privacy"))} />
        <Button title={t.common.signOut} variant="outline" onPress={signOut} />
        <Button title={a.deleteAccount} variant="danger" onPress={() => confirmDeleteAccount(t, locale, signOut)} />
      </View>
    </Screen>
  );
}

function ProfileForm({
  userId,
  initialName,
  initialPhone,
  initialReminders,
  remindersAvailable,
  onSaved,
}: {
  userId: string;
  initialName: string;
  initialPhone: string;
  initialReminders: boolean;
  remindersAvailable: boolean;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [reminders, setReminders] = useState(initialReminders);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    const normalized = phone.trim() ? normalizeMalaysianPhone(phone) : null;
    if (phone.trim() && !normalized) {
      setMessage({ text: t.common.malaysianPhone, ok: false });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: name.trim().slice(0, 80) || null,
        phone: normalized,
        ...(remindersAvailable ? { reminders_opt_in: reminders } : {}),
      })
      .eq("id", userId);
    setSaving(false);
    setMessage(error ? { text: t.account.profileError, ok: false } : { text: t.common.saved, ok: true });
    if (!error) onSaved();
  }

  return (
    <Section title={t.account.profile}>
      <Field label={t.account.name} value={name} onChangeText={setName} maxLength={80} autoComplete="name" />
      <Field label={t.account.mobile} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" placeholder="012-345 6789" />
      {remindersAvailable ? (
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <Text style={[styles.body, { flex: 1 }]}>{t.account.reminders}</Text>
          <Switch value={reminders} onValueChange={setReminders} trackColor={{ true: colors.brand600 }} accessibilityLabel={t.account.reminders} />
        </View>
      ) : null}
      {message ? <Notice text={message.text} tone={message.ok ? "green" : "error"} /> : null}
      <Button title={t.common.save} loading={saving} onPress={save} />
    </Section>
  );
}

function LanguagePicker({ locale, onChange }: { locale: Locale; onChange: (l: Locale) => void }) {
  const { t } = useI18n();
  return (
    <Section title={t.account.language}>
      <View style={styles.wrap}>
        {LOCALES.map((l) => (
          <Chip key={l} label={LOCALE_NAMES[l]} selected={l === locale} onPress={() => isLocale(l) && onChange(l)} />
        ))}
      </View>
    </Section>
  );
}
