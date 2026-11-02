import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { Button, Card, Chip, Empty, ErrorView, Field, Loading, Notice, Screen, Section, styles } from "@/components/ui";
import { sendQuote, track } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getListing } from "@/lib/data";
import { priceRangeLabel } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { openExternal } from "@/lib/links";
import { supabase } from "@/lib/supabase";
import { space } from "@/lib/theme";
import { useAsync } from "@/lib/use-async";

const EVENT_TYPES = ["wedding", "engagement", "dinner", "photoshoot", "graduation", "other"] as const;

export default function Quote() {
  const params = useLocalSearchParams<{ slug: string; package?: string }>();
  const { t, locale } = useI18n();
  const q = t.quote;
  const { userId } = useAuth();

  const { data, loading, reload } = useAsync(async () => {
    const [listing, profile] = await Promise.all([
      getListing(params.slug),
      userId ? supabase.from("profiles").select("display_name, phone").eq("id", userId).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    return { listing, profile: profile.data as { display_name: string | null; phone: string | null } | null };
  }, [params.slug, userId]);

  const [packageId, setPackageId] = useState<string | null>(null);
  const [eventType, setEventType] = useState<(typeof EVENT_TYPES)[number]>("wedding");
  const [eventDate, setEventDate] = useState("");
  const [people, setPeople] = useState("");
  const [budget, setBudget] = useState("");
  const [where, setWhere] = useState("");
  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);

  if (!userId) {
    return (
      <Empty title={t.login.lead}>
        <Button title={t.login.signIn} onPress={() => router.push("/login")} style={{ marginTop: space(4) }} />
      </Empty>
    );
  }
  if (!data && loading) return <Loading />;
  if (!data) return <ErrorView onRetry={reload} />;
  const listing = data.listing;
  if (!listing || listing.status !== "active") return <Empty title={t.shop.notFound} />;

  const packages = listing.packages;
  // The package picked on the shop page, until the customer changes it.
  const chosen = packageId ?? (packages.some((p) => String(p.id) === params.package) ? params.package! : "");
  const nameValue = name ?? data.profile?.display_name ?? "";
  const phoneValue = phone ?? (data.profile?.phone ? `0${data.profile.phone.slice(2)}` : "");

  async function submit() {
    setError(null);
    if (eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(eventDate.trim())) {
      setError(q.badDate);
      return;
    }
    if (!nameValue.trim()) {
      setError(t.booking.yourName);
      return;
    }
    if (!phoneValue.trim()) {
      setError(t.common.malaysianPhone);
      return;
    }
    const count = people.trim() ? Number.parseInt(people.trim(), 10) : NaN;
    setSending(true);
    const res = await sendQuote(
      {
        listingId: listing!.id,
        packageId: chosen ? Number(chosen) : "",
        eventType,
        eventDate: eventDate.trim(),
        people: Number.isFinite(count) && count > 0 ? count : "",
        location: where.trim(),
        budget: budget.trim(),
        name: nameValue.trim(),
        phone: phoneValue.trim(),
        note: note.trim(),
      },
      locale,
    );
    setSending(false);
    if (!res.ok) {
      setError(res.error ?? t.common.offline);
      return;
    }
    if (res.data.whatsappUrl) {
      setWhatsappUrl(res.data.whatsappUrl);
      track(listing!.id, "whatsapp", locale);
      void openExternal(res.data.whatsappUrl);
    }
  }

  if (whatsappUrl) {
    return (
      <Screen>
        <Stack.Screen options={{ title: q.title }} />
        <Card>
          <Text style={styles.h2}>{t.booking.sentTitle}</Text>
          <Text style={styles.body}>{t.booking.sentBody}</Text>
        </Card>
        <Button title={t.booking.openWhatsApp} variant="whatsapp" onPress={() => void openExternal(whatsappUrl)} />
        <Button title={t.common.done} variant="outline" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen options={{ title: q.title }} />
      <Screen>
        <Text style={styles.h2}>{listing.name}</Text>
        {error ? <Notice text={error} tone="error" /> : null}

        {packages.length > 0 ? (
          <Section title={q.package}>
            <View style={styles.wrap}>
              <Chip label={q.notSure} selected={!chosen} onPress={() => setPackageId("")} />
              {packages.map((p) => {
                const price = priceRangeLabel(p.price_from, p.price_to, locale);
                return (
                  <Chip
                    key={p.id}
                    label={`${p.name}${price ? ` · ${price}` : ""}`}
                    selected={chosen === String(p.id)}
                    onPress={() => setPackageId(String(p.id))}
                  />
                );
              })}
            </View>
          </Section>
        ) : null}

        <Section title={q.occasion}>
          <View style={styles.wrap}>
            {EVENT_TYPES.map((e) => (
              <Chip key={e} label={q.eventTypes[e]} selected={eventType === e} onPress={() => setEventType(e)} />
            ))}
          </View>
        </Section>

        <Field label={q.date} value={eventDate} onChangeText={setEventDate} placeholder="2026-12-20" maxLength={10} autoCapitalize="none" />
        <Field
          label={q.people}
          value={people}
          onChangeText={(v) => setPeople(v.replace(/[^0-9]/g, ""))}
          placeholder={q.peoplePlaceholder}
          keyboardType="number-pad"
          maxLength={3}
        />
        <Field label={q.budget} value={budget} onChangeText={setBudget} placeholder={q.budgetPlaceholder} maxLength={40} />
        <Field label={q.where} value={where} onChangeText={setWhere} placeholder={q.wherePlaceholder} maxLength={200} />
        <Field label={t.booking.yourName} value={nameValue} onChangeText={setName} maxLength={80} autoComplete="name" />
        <Field
          label={t.booking.phone}
          value={phoneValue}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          placeholder="012-345 6789"
          maxLength={20}
        />
        <Field label={q.anythingElse} value={note} onChangeText={setNote} multiline maxLength={500} />

        <Button title={q.send} variant="whatsapp" loading={sending} onPress={submit} />
        <Text style={styles.small}>{t.booking.disclaimer}</Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}
