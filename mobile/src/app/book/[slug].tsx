import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { Button, Card, Chip, Empty, ErrorView, Field, Loading, Notice, Screen, Section, styles } from "@/components/ui";
import { type BookingResult, type Slot, fetchSlots, sendBooking, track } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getListing } from "@/lib/data";
import { priceLabel } from "@/lib/format";
import { malaysiaNow, timeSlots } from "@/lib/hours";
import { fmt, useI18n } from "@/lib/i18n";
import { HTML_LANG, type Locale } from "@/lib/i18n/config";
import { localTime, serviceName } from "@/lib/i18n/names";
import { openExternal } from "@/lib/links";
import { supabase } from "@/lib/supabase";
import { colors, space } from "@/lib/theme";
import { useAsync } from "@/lib/use-async";

const DAYS_AHEAD = 14;

// Same day list as the website's booking form, in Malaysian time.
function upcomingDates(days: number, locale: Locale, words: { today: string; tomorrow: string }) {
  const today = malaysiaNow();
  const base = new Date(`${today.date}T12:00:00+08:00`);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(base.getTime() + i * 86_400_000);
    const value = d.toISOString().slice(0, 10);
    const label =
      i === 0
        ? words.today
        : i === 1
          ? words.tomorrow
          : new Intl.DateTimeFormat(HTML_LANG[locale], { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(d);
    return { value, label, weekday: (today.weekday + i) % 7 };
  });
}

export default function Book() {
  const params = useLocalSearchParams<{ slug: string; service?: string; staff?: string; deal?: string }>();
  const { t } = useI18n();
  const { userId } = useAuth();

  const { data, loading, reload } = useAsync(async () => {
    const [listing, profile] = await Promise.all([
      getListing(params.slug),
      userId ? supabase.from("profiles").select("display_name, phone").eq("id", userId).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    return { listing, profile: profile.data as { display_name: string | null; phone: string | null } | null };
  }, [params.slug, userId]);

  if (!userId) {
    return (
      <Empty title={t.login.lead}>
        <Button title={t.login.signIn} onPress={() => router.push("/login")} style={{ marginTop: space(4) }} />
      </Empty>
    );
  }
  if (!data && loading) return <Loading />;
  if (!data) return <ErrorView onRetry={reload} />;
  if (!data.listing) return <Empty title={t.shop.notFound} />;
  return <BookingForm listing={data.listing} profile={data.profile} initial={params} />;
}

function BookingForm({
  listing,
  profile,
  initial,
}: {
  listing: NonNullable<Awaited<ReturnType<typeof getListing>>>;
  profile: { display_name: string | null; phone: string | null } | null;
  initial: { service?: string; staff?: string; deal?: string };
}) {
  const { t, locale } = useI18n();
  const b = t.booking;
  const instant = listing.is_claimed && listing.booking?.instant_enabled ? listing.booking : null;
  const services = listing.services;
  const today = malaysiaNow().date;
  const liveDeals = listing.promotions.filter((p) => p.starts_on <= today && p.ends_on >= today);
  const waNumber = listing.whatsapp ?? (listing.phone?.startsWith("601") ? listing.phone : null);
  const bookable = listing.status === "active" && !!waNumber;

  const [serviceId, setServiceId] = useState<string>(
    services.some((s) => String(s.id) === initial.service) ? initial.service! : String(services[0]?.id ?? ""),
  );
  const [staffId, setStaffId] = useState<string>(listing.staff.some((s) => String(s.id) === initial.staff) ? initial.staff! : "");
  const [dealId, setDealId] = useState<string>(liveDeals.some((p) => String(p.id) === initial.deal) ? initial.deal! : "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [name, setName] = useState(profile?.display_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ? `0${profile.phone.slice(2)}` : "");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BookingResult | null>(null);

  const dates = useMemo(
    () => upcomingDates(instant ? instant.max_days_ahead : DAYS_AHEAD, locale, { today: b.today, tomorrow: b.tomorrow }),
    [instant, locale, b.today, b.tomorrow],
  );
  const selected = dates.find((d) => d.value === date);

  // Request mode: every 30 minutes inside opening hours.
  const requestSlots = useMemo(() => {
    if (!selected || instant) return [];
    const now = malaysiaNow();
    const all =
      listing.hours.length > 0
        ? timeSlots(listing.hours, selected.weekday)
        : timeSlots([{ weekday: selected.weekday, opens: "10:00", closes: "21:30" }], selected.weekday);
    if (selected.value !== now.date) return all;
    return all.filter((x) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3)) > now.minutes + 30);
  }, [selected, listing.hours, instant]);

  // Instant mode: ask the server which slots are still free.
  const [free, setFree] = useState<{ key: string; slots: Slot[] } | null>(null);
  const freeKey = `${date}|${serviceId}|${staffId}`;
  useEffect(() => {
    if (!instant || !date || !serviceId) return;
    let cancelled = false;
    fetchSlots({ listingId: listing.id, date, serviceId: Number(serviceId), staffId: staffId ? Number(staffId) : null }, locale).then(
      (slots) => {
        if (!cancelled) setFree({ key: `${date}|${serviceId}|${staffId}`, slots: slots ?? [] });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [instant, listing.id, date, serviceId, staffId, locale]);
  const loadingSlots = !!instant && !!date && free?.key !== freeKey;
  const instantSlots = free?.key === freeKey ? free.slots : [];

  async function submit() {
    setError(null);
    if (!serviceId) {
      setError(b.chooseService);
      return;
    }
    if (!name.trim()) {
      setError(t.booking.yourName);
      return;
    }
    setSending(true);
    const res = await sendBooking(
      {
        listingId: listing.id,
        serviceId: Number(serviceId),
        date: date && time ? date : "",
        time: date && time ? time : "",
        name: name.trim(),
        phone: phone.trim(),
        note: note.trim(),
        staffId: staffId ? Number(staffId) : "",
        promotionId: dealId ? Number(dealId) : "",
      },
      locale,
    );
    setSending(false);
    if (!res.ok) {
      setError(res.error ?? t.common.offline);
      return;
    }
    setResult(res.data);
    if (res.data.whatsappUrl && !res.data.confirmed) {
      track(listing.id, "whatsapp", locale);
      void openExternal(res.data.whatsappUrl);
    }
  }

  if (!bookable) return <Empty title={t.shop.notFound} />;

  if (result) {
    return (
      <Screen>
        <Stack.Screen options={{ title: listing.name }} />
        {result.confirmed ? (
          <Card style={{ backgroundColor: colors.green50, borderColor: colors.green50 }}>
            <Text style={styles.h2}>{b.booked}</Text>
            <Text style={styles.body}>{fmt(b.bookedAt, { shop: result.confirmed.shopName, when: result.confirmed.when })}</Text>
            <Text style={styles.muted}>
              {b.code}: <Text style={{ fontWeight: "700", color: colors.ink }}>{result.confirmed.shortCode}</Text>
            </Text>
          </Card>
        ) : (
          <Card>
            <Text style={styles.h2}>{b.sentTitle}</Text>
            <Text style={styles.body}>{b.sentBody}</Text>
          </Card>
        )}
        {result.whatsappUrl ? (
          <Button
            title={result.confirmed ? b.tellShop : b.openWhatsApp}
            variant="whatsapp"
            onPress={() => {
              track(listing.id, "whatsapp", locale);
              void openExternal(result.whatsappUrl!);
            }}
          />
        ) : null}
        <Button title={t.common.done} variant="outline" onPress={() => router.back()} />
      </Screen>
    );
  }

  const times = instant ? instantSlots.map((s) => s.time) : requestSlots;
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen options={{ title: instant ? b.instantTitle : b.title }} />
      <Screen>
        <Text style={styles.h2}>{listing.name}</Text>
        {error ? <Notice text={error} tone="error" /> : null}

        {services.length > 0 ? (
          <Section title={b.service}>
            <View style={styles.wrap}>
              {services.map((s) => {
                const price = priceLabel(s, locale);
                return (
                  <Chip
                    key={s.id}
                    label={`${serviceName(s, locale)}${price ? ` · ${price}` : ""}`}
                    selected={serviceId === String(s.id)}
                    onPress={() => setServiceId(String(s.id))}
                  />
                );
              })}
            </View>
          </Section>
        ) : null}

        {listing.staff.length > 0 ? (
          <Section title={b.with}>
            <View style={styles.wrap}>
              <Chip label={b.anyone} selected={!staffId} onPress={() => setStaffId("")} />
              {listing.staff.map((s) => (
                <Chip key={s.id} label={s.name} selected={staffId === String(s.id)} onPress={() => setStaffId(String(s.id))} />
              ))}
            </View>
          </Section>
        ) : null}

        {liveDeals.length > 0 ? (
          <Section title={b.deal}>
            <View style={styles.wrap}>
              <Chip label={b.noDeal} selected={!dealId} onPress={() => setDealId("")} />
              {liveDeals.map((p) => (
                <Chip
                  key={p.id}
                  label={`${p.title}${p.price_label ? ` · ${p.price_label}` : ""}`}
                  selected={dealId === String(p.id)}
                  onPress={() => setDealId(String(p.id))}
                />
              ))}
            </View>
          </Section>
        ) : null}

        <Section title={b.day}>
          <View style={styles.wrap}>
            {!instant ? (
              <Chip
                label={b.anyDay}
                selected={!date}
                onPress={() => {
                  setDate("");
                  setTime("");
                }}
              />
            ) : null}
            {dates.map((d) => (
              <Chip
                key={d.value}
                label={d.label}
                selected={date === d.value}
                onPress={() => {
                  setDate(d.value);
                  setTime("");
                }}
              />
            ))}
          </View>
        </Section>

        {date ? (
          <Section title={b.time}>
            {loadingSlots ? (
              <View style={styles.row}>
                <ActivityIndicator color={colors.brand600} />
                <Text style={styles.muted}>{b.checking}</Text>
              </View>
            ) : times.length === 0 ? (
              <Text style={styles.muted}>{instant ? b.fullyBooked : t.common.closed}</Text>
            ) : (
              <View style={styles.wrap}>
                {!instant ? <Chip label={b.anyTime} selected={!time} onPress={() => setTime("")} /> : null}
                {times.map((x) => {
                  const left = instantSlots.find((s) => s.time === x)?.left;
                  return (
                    <Chip
                      key={x}
                      label={`${localTime(x, locale)}${instant && left === 1 ? ` · ${b.lastSpot}` : ""}`}
                      selected={time === x}
                      onPress={() => setTime(x)}
                    />
                  );
                })}
              </View>
            )}
          </Section>
        ) : instant ? (
          <Text style={styles.muted}>{b.pickDay}</Text>
        ) : null}

        <Field label={b.yourName} value={name} onChangeText={setName} maxLength={80} autoComplete="name" />
        <Field
          label={instant ? b.phone : b.phoneOptional}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          placeholder="012-345 6789"
          maxLength={20}
        />
        <Field label={b.note} value={note} onChangeText={setNote} placeholder={b.notePlaceholder} multiline maxLength={300} />

        <Button
          title={sending ? b.sending : instant ? b.bookThis : b.send}
          variant="whatsapp"
          loading={sending}
          disabled={!!instant && (!date || !time)}
          onPress={submit}
        />
        <Text style={styles.small}>{instant ? b.instantNote : b.disclaimer}</Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}
