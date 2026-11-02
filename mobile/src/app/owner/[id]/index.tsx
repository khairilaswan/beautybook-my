import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Text, TextInput, View } from "react-native";
import { Button, Card, Empty, ErrorView, Loading, Pill, Screen, Section, Stars, styles } from "@/components/ui";
import { refreshWebsite } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { daysAgoIso, formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { openExternal, openWebPage, webPath } from "@/lib/links";
import {
  EVENT_TYPE_LABELS,
  QUOTE_ACTIONS,
  QUOTE_STATUS_LABELS,
  REQUEST_ACTIONS,
  REQUEST_STATUS_LABELS,
  SAVE_FAILED,
  loadOwnerListing,
} from "@/lib/owner";
import { supabase } from "@/lib/supabase";
import { colors, radius, space } from "@/lib/theme";
import { useAsync } from "@/lib/use-async";

type Request = {
  id: string;
  short_code: string | null;
  service_name: string;
  staff_name: string | null;
  instant: boolean;
  preferred_at: string | null;
  customer_name: string;
  customer_phone: string | null;
  note: string | null;
  status: string;
  created_at: string;
};

type QuoteRow = {
  id: string;
  package_name: string | null;
  event_type: string;
  event_date: string | null;
  people: number | null;
  location: string | null;
  budget: string | null;
  customer_name: string;
  customer_phone: string | null;
  note: string | null;
  status: string;
  created_at: string;
};

type ReviewRow = {
  id: number;
  author_name: string;
  rating: number;
  body: string | null;
  service_name: string | null;
  owner_reply: string | null;
  created_at: string;
};

const STAT_KINDS = [
  { kind: "view", label: "Page views" },
  { kind: "whatsapp", label: "WhatsApp taps" },
  { kind: "call", label: "Calls" },
  { kind: "request", label: "Booking & quote requests" },
  { kind: "directions", label: "Directions" },
  { kind: "website", label: "Website & social" },
] as const;

// The owner dashboard's everyday parts. Owner screens are in English, like
// the website's owner dashboard.
export default function OwnerDashboard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId, config } = useAuth();
  const { locale } = useI18n();

  const { data, loading, reload } = useAsync(
    async () => {
      const listing = await loadOwnerListing(id, userId);
      if (!listing) return null;
      const since = daysAgoIso(30).slice(0, 10);
      const [requests, quotes, stats, reviews] = await Promise.all([
        supabase
          .from("booking_requests")
          .select("id, short_code, service_name, staff_name, instant, preferred_at, customer_name, customer_phone, note, status, created_at")
          .eq("listing_id", id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("quote_requests")
          .select("id, package_name, event_type, event_date, people, location, budget, customer_name, customer_phone, note, status, created_at")
          .eq("listing_id", id)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase.from("listing_stats").select("day, kind, count").eq("listing_id", id).gte("day", since),
        config.reviewsEnabled
          ? supabase
              .from("reviews")
              .select("id, author_name, rating, body, service_name, owner_reply, created_at")
              .eq("listing_id", id)
              .order("created_at", { ascending: false })
              .limit(30)
          : Promise.resolve({ data: [] as ReviewRow[] }),
      ]);
      return {
        listing,
        requests: (requests.data ?? []) as Request[],
        quotes: (quotes.data ?? []) as QuoteRow[],
        stats: (stats.data ?? []) as { day: string; kind: string; count: number }[],
        reviews: (reviews.data ?? []) as ReviewRow[],
      };
    },
    [id, userId, config.reviewsEnabled],
    { refetchOnFocus: true },
  );

  const [busy, setBusy] = useState<string | null>(null);

  if (data === undefined) return loading ? <Loading /> : <ErrorView onRetry={reload} />;
  if (data === null) return <Empty title="You don't manage this business." />;
  const { listing } = data;

  const total = (kind: string) => data.stats.filter((r) => r.kind === kind).reduce((s, r) => s + r.count, 0);
  const views = total("view");
  const contacts = total("whatsapp") + total("call") + total("request");
  const days = Array.from({ length: 30 }, (_, i) => daysAgoIso(29 - i).slice(0, 10));
  const daily = days.map((d) => data.stats.filter((r) => r.kind === "view" && r.day === d).reduce((s, r) => s + r.count, 0));
  const peak = Math.max(1, ...daily);

  async function setRequestStatus(requestId: string, status: string) {
    setBusy(requestId);
    const { data: rows, error } = await supabase.from("booking_requests").update({ status }).eq("id", requestId).select("id");
    setBusy(null);
    if (error || !rows?.length) Alert.alert("You can't update this request.");
    else void reload();
  }

  async function setQuoteStatus(quoteId: string, status: string) {
    setBusy(quoteId);
    const { data: rows, error } = await supabase
      .from("quote_requests")
      .update({ status })
      .eq("id", quoteId)
      .eq("listing_id", id)
      .select("id");
    setBusy(null);
    if (error || !rows?.length) Alert.alert(SAVE_FAILED);
    else void reload();
  }

  const edit = (screen: "details" | "menu" | "hours" | "photos") =>
    router.push({ pathname: `/owner/[id]/${screen}`, params: { id } });

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Stack.Screen options={{ title: listing.name }} />
      <View style={{ gap: space(1) }}>
        <Text style={styles.h2}>{listing.name}</Text>
        {listing.status === "active" ? (
          <Text
            style={styles.link}
            accessibilityRole="link"
            onPress={() => router.push({ pathname: "/salon/[slug]", params: { slug: listing.slug } })}
          >
            View public page
          </Text>
        ) : (
          <Text style={styles.muted}>Not public yet ({listing.status})</Text>
        )}
      </View>

      <Section title="Edit your listing">
        <View style={styles.wrap}>
          <Button title="Shop profile" variant="outline" small onPress={() => edit("details")} />
          <Button title="Menu and prices" variant="outline" small onPress={() => edit("menu")} />
          <Button title="Opening hours" variant="outline" small onPress={() => edit("hours")} />
          <Button title="Photos" variant="outline" small onPress={() => edit("photos")} />
        </View>
        <Text style={styles.small}>
          Deals, packages, team, portfolio, instant booking, loyalty and vouchers are on the full dashboard on the website.
        </Text>
        <Button
          title="Open the full dashboard"
          variant="ghost"
          small
          style={{ alignSelf: "flex-start" }}
          onPress={() => openWebPage(webPath(locale, `/owner/${id}`))}
        />
      </Section>

      <Section title="Last 30 days">
        <View style={styles.wrap}>
          {STAT_KINDS.map((s) => (
            <View
              key={s.kind}
              style={{
                width: "47%",
                backgroundColor: colors.white,
                borderColor: colors.line,
                borderWidth: 1,
                borderRadius: radius.md,
                padding: space(3),
              }}
            >
              <Text style={styles.small}>{s.label}</Text>
              <Text style={{ fontSize: 22, fontWeight: "700", color: colors.ink }}>{total(s.kind)}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.muted}>
          {views > 0
            ? `${Math.round((contacts / views) * 100)}% of visitors contacted you or sent a request.`
            : "Numbers appear as people visit your page."}
        </Text>
        <View
          style={{ flexDirection: "row", alignItems: "flex-end", height: 64, gap: 2 }}
          accessible
          accessibilityLabel={`Page views per day, last 30 days: ${views} in total`}
        >
          {daily.map((v, i) => (
            <View
              key={days[i]}
              style={{
                flex: 1,
                height: Math.max((v / peak) * 60, v ? 3 : 1),
                backgroundColor: v ? colors.brand600 : colors.line,
                borderRadius: 2,
              }}
            />
          ))}
        </View>
      </Section>

      <Section title="Booking requests">
        {data.requests.length === 0 ? (
          <Text style={styles.muted}>No requests yet. They appear here as soon as a customer sends one.</Text>
        ) : (
          data.requests.map((r) => (
            <Card key={r.id}>
              <View style={[styles.row, { flexWrap: "wrap", gap: space(2) }]}>
                <Text style={styles.h3}>
                  {r.customer_name} · {r.service_name}
                  {r.staff_name ? ` · with ${r.staff_name}` : ""}
                </Text>
                {r.instant ? <Pill label="Booked online" tone="green" /> : null}
              </View>
              <Text style={styles.muted}>
                {r.preferred_at ? `For ${formatDate(r.preferred_at)}` : "Any time"} · sent {formatDate(r.created_at)} ·{" "}
                {REQUEST_STATUS_LABELS[r.status] ?? r.status}
                {r.short_code ? ` · ${r.short_code}` : ""}
              </Text>
              {r.note ? <Text style={styles.body}>“{r.note}”</Text> : null}
              <View style={styles.wrap}>
                {(REQUEST_ACTIONS[r.status] ?? []).map((a, i) => (
                  <Button
                    key={a.status}
                    title={a.label}
                    small
                    variant={i === 0 ? "primary" : "outline"}
                    disabled={busy === r.id}
                    onPress={() => setRequestStatus(r.id, a.status)}
                  />
                ))}
                {r.customer_phone ? (
                  <Button
                    title="WhatsApp"
                    small
                    variant="whatsapp"
                    onPress={() => void openExternal(`https://wa.me/${r.customer_phone}`)}
                  />
                ) : null}
                {r.customer_phone ? (
                  <Button title="Call" small variant="outline" onPress={() => void openExternal(`tel:+${r.customer_phone}`)} />
                ) : null}
              </View>
            </Card>
          ))
        )}
      </Section>

      {data.quotes.length > 0 ? (
        <Section title="Quote requests">
          {data.quotes.map((q) => (
            <Card key={q.id}>
              <Text style={styles.h3}>
                {q.customer_name} · {q.package_name ?? "Custom quote"}
              </Text>
              <Text style={styles.muted}>
                {EVENT_TYPE_LABELS[q.event_type] ?? q.event_type}
                {q.event_date ? ` · ${formatDate(q.event_date)}` : ""}
                {q.people ? ` · ${q.people} people` : ""}
                {q.budget ? ` · budget ${q.budget}` : ""} · {QUOTE_STATUS_LABELS[q.status] ?? q.status}
              </Text>
              {q.location ? <Text style={styles.body}>Where: {q.location}</Text> : null}
              {q.note ? <Text style={styles.body}>“{q.note}”</Text> : null}
              <View style={styles.wrap}>
                {(QUOTE_ACTIONS[q.status] ?? []).map((a, i) => (
                  <Button
                    key={a.status}
                    title={a.label}
                    small
                    variant={i === 0 ? "primary" : "outline"}
                    disabled={busy === q.id}
                    onPress={() => setQuoteStatus(q.id, a.status)}
                  />
                ))}
                {q.customer_phone ? (
                  <Button
                    title="WhatsApp"
                    small
                    variant="whatsapp"
                    onPress={() => void openExternal(`https://wa.me/${q.customer_phone}`)}
                  />
                ) : null}
              </View>
            </Card>
          ))}
        </Section>
      ) : null}

      {config.reviewsEnabled ? (
        <Section title="Reviews">
          {data.reviews.length === 0 ? (
            <Text style={styles.muted}>No reviews yet. Customers can review a visit once you mark it completed.</Text>
          ) : (
            data.reviews.map((r) => (
              <ReviewCard key={r.id} review={r} listingId={id} locale={locale} onSaved={reload} />
            ))
          )}
        </Section>
      ) : null}
    </Screen>
  );
}

function ReviewCard({
  review,
  listingId,
  locale,
  onSaved,
}: {
  review: ReviewRow;
  listingId: string;
  locale: "en" | "ms" | "zh";
  onSaved: () => void;
}) {
  const [reply, setReply] = useState(review.owner_reply ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMessage(null);
    const text = reply.trim().slice(0, 1000);
    const { data, error } = await supabase
      .from("reviews")
      .update({ owner_reply: text || null, owner_replied_at: text ? new Date().toISOString() : null })
      .eq("id", review.id)
      .eq("listing_id", listingId)
      .select("id");
    setSaving(false);
    if (error || !data?.length) {
      setMessage(SAVE_FAILED);
      return;
    }
    refreshWebsite(listingId, "reviews", locale);
    setMessage(text ? "Reply posted." : "Reply removed.");
    onSaved();
  }

  return (
    <Card>
      <View style={[styles.row, { gap: space(2) }]}>
        <Stars value={review.rating} />
        <Text style={styles.h3}>{review.author_name}</Text>
      </View>
      <Text style={styles.small}>
        {[review.service_name, formatDate(review.created_at)].filter(Boolean).join(" · ")}
      </Text>
      {review.body ? <Text style={styles.body}>{review.body}</Text> : null}
      <TextInput
        value={reply}
        onChangeText={setReply}
        placeholder="Write a public reply (optional)"
        placeholderTextColor={colors.muted}
        multiline
        maxLength={1000}
        accessibilityLabel={`Reply to ${review.author_name}`}
        style={[styles.input, styles.inputMultiline]}
      />
      <View style={[styles.row, { gap: space(3) }]}>
        <Button
          title={review.owner_reply ? "Update reply" : "Post reply"}
          small
          variant="outline"
          loading={saving}
          disabled={reply.trim() === (review.owner_reply ?? "")}
          onPress={save}
        />
        {message ? <Text style={styles.small}>{message}</Text> : null}
      </View>
    </Card>
  );
}
