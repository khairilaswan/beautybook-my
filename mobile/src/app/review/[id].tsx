import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { Button, Card, Empty, ErrorView, Field, Loading, Notice, Screen, styles } from "@/components/ui";
import { refreshWebsite } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { fmt, useI18n } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { colors, space } from "@/lib/theme";
import { useAsync } from "@/lib/use-async";

type Booking = {
  id: string;
  listing_id: string;
  service_name: string;
  preferred_at: string | null;
  listings: { slug: string; name: string } | null;
};

// Same rules as the website's review page: only your own booking requests,
// one review per visit, and the database only accepts it once the shop has
// marked the visit done.
export default function Review() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const r = t.review;
  const { userId, config } = useAuth();

  const { data, loading, reload } = useAsync(async () => {
    if (!userId) return null;
    const [booking, existing, profile] = await Promise.all([
      supabase
        .from("booking_requests")
        .select("id, listing_id, service_name, preferred_at, listings ( slug, name )")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase.from("reviews").select("id, rating, body, author_name").eq("booking_request_id", id).maybeSingle(),
      supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    ]);
    if (booking.error) throw booking.error;
    return {
      booking: booking.data as unknown as Booking | null,
      existing: existing.data as { id: string; rating: number; body: string | null; author_name: string } | null,
      firstName: ((profile.data?.display_name as string | null) ?? "").split(" ")[0] ?? "",
    };
  }, [id, userId]);

  const [rating, setRating] = useState<number | null>(null);
  const [body, setBody] = useState<string | null>(null);
  const [author, setAuthor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!config.reviewsEnabled) return <Empty title={t.shop.notFound} />;
  if (data === undefined) return loading ? <Loading /> : <ErrorView onRetry={reload} />;
  if (!data?.booking) return <Empty title={t.shop.notFound} />;

  const booking = data.booking;
  const shop = booking.listings?.name ?? "";
  const ratingValue = rating ?? data.existing?.rating ?? 0;
  const bodyValue = body ?? data.existing?.body ?? "";
  const authorValue = author ?? data.existing?.author_name ?? data.firstName;

  async function save() {
    setError(null);
    if (ratingValue < 1) {
      setError(r.pickRating);
      return;
    }
    if (!authorValue.trim()) {
      setError(r.addName);
      return;
    }
    setSaving(true);
    const fields = { rating: ratingValue, body: bodyValue.trim() || null, author_name: authorValue.trim().slice(0, 40) };
    const { error: dbError } = data!.existing
      ? await supabase.from("reviews").update(fields).eq("id", data!.existing.id)
      : await supabase.from("reviews").insert({
          ...fields,
          listing_id: booking.listing_id,
          booking_request_id: booking.id,
          user_id: userId,
          service_name: booking.service_name,
        });
    if (dbError) {
      setSaving(false);
      setError(r.notYet);
      return;
    }
    await refreshWebsite(booking.listing_id, "reviews", locale);
    setSaving(false);
    setDone(true);
  }

  if (done) {
    return (
      <Screen>
        <Stack.Screen options={{ title: r.title }} />
        <Card style={{ backgroundColor: colors.green50, borderColor: colors.green50 }}>
          <Text style={styles.h3}>{r.thanks}</Text>
        </Card>
        {booking.listings ? (
          <Button
            title={shop}
            variant="outline"
            onPress={() => router.replace({ pathname: "/salon/[slug]", params: { slug: booking.listings!.slug } })}
          />
        ) : null}
        <Button title={t.common.done} onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen options={{ title: r.title }} />
      <Screen>
        <Text style={styles.h2}>{fmt(r.heading, { shop })}</Text>
        <Text style={styles.muted}>
          {[booking.service_name, booking.preferred_at ? formatDate(booking.preferred_at, locale) : null].filter(Boolean).join(" · ")}
        </Text>
        {error ? <Notice text={error} tone="error" /> : null}

        <Text style={styles.label}>{r.yourRating}</Text>
        <View style={[styles.row, { gap: space(2) }]} accessibilityRole="radiogroup">
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable
              key={n}
              onPress={() => setRating(n)}
              accessibilityRole="radio"
              accessibilityState={{ checked: ratingValue === n }}
              accessibilityLabel={`${n} / 5`}
              hitSlop={6}
            >
              <Text style={{ fontSize: 36, color: n <= ratingValue ? colors.brand600 : colors.line }}>★</Text>
            </Pressable>
          ))}
        </View>

        <Field
          label={r.yourReview}
          value={bodyValue}
          onChangeText={setBody}
          placeholder={r.placeholder}
          multiline
          maxLength={1000}
          style={{ minHeight: 120, textAlignVertical: "top" }}
        />
        <Field label={r.nameToShow} value={authorValue} onChangeText={setAuthor} maxLength={40} />
        <Button title={r.post} loading={saving} onPress={save} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
