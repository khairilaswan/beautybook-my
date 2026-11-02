import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { Button, Card, Empty, ErrorView, Loading, Notice, Screen, Section, styles } from "@/components/ui";
import { refreshWebsite } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { WEEKDAYS, hhmm } from "@/lib/hours";
import { useI18n } from "@/lib/i18n";
import { type OwnerListing, SAVE_FAILED, loadOwnerListing } from "@/lib/owner";
import { supabase } from "@/lib/supabase";
import { colors, space } from "@/lib/theme";
import { useAsync } from "@/lib/use-async";

type Slot = { opens: string; closes: string };
type Closure = { date_from: string; date_to: string; note: string };
type HoursRow = { weekday: number; opens: string; closes: string };

const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

export default function OwnerHours() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();
  const { data, loading, reload } = useAsync(async () => {
    const listing = await loadOwnerListing(id, userId);
    if (!listing) return null;
    const [hours, closures] = await Promise.all([
      supabase.from("opening_hours").select("weekday, opens, closes").eq("listing_id", id),
      supabase.from("closures").select("date_from, date_to, note").eq("listing_id", id).order("date_from"),
    ]);
    if (hours.error) throw hours.error;
    if (closures.error) throw closures.error;
    return {
      listing,
      hours: (hours.data ?? []) as HoursRow[],
      closures: (closures.data ?? []) as { date_from: string; date_to: string; note: string | null }[],
    };
  }, [id, userId]);

  if (data === undefined) return loading ? <Loading /> : <ErrorView onRetry={reload} />;
  if (data === null) return <Empty title="You don't manage this business." />;
  return <HoursEditor listing={data.listing} initialHours={data.hours} initialClosures={data.closures} />;
}

// Accepts "9:00", "0900" or "09:00" and returns "09:00" (or the input as typed).
function tidyTime(v: string): string {
  const s = v.trim().replace(".", ":");
  const m = /^(\d{1,2}):?(\d{2})$/.exec(s);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : s;
}

function HoursEditor({
  listing,
  initialHours,
  initialClosures,
}: {
  listing: OwnerListing;
  initialHours: HoursRow[];
  initialClosures: { date_from: string; date_to: string; note: string | null }[];
}) {
  const { locale } = useI18n();
  const [days, setDays] = useState<Slot[][]>(
    WEEKDAYS.map((_, d) =>
      initialHours
        .filter((h) => h.weekday === d)
        .sort((a, b) => a.opens.localeCompare(b.opens))
        .map((h) => ({ opens: hhmm(h.opens), closes: hhmm(h.closes) })),
    ),
  );
  const [closures, setClosures] = useState<Closure[]>(initialClosures.map((c) => ({ ...c, note: c.note ?? "" })));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const setDay = (d: number, slots: Slot[]) => setDays(days.map((s, i) => (i === d ? slots : s)));
  const setSlot = (d: number, i: number, patch: Partial<Slot>) =>
    setDay(d, days[d].map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const setClosure = (i: number, patch: Partial<Closure>) =>
    setClosures(closures.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  async function save() {
    setStatus(null);
    const hours = days.flatMap((slots, weekday) =>
      slots.map((s) => ({ weekday, opens: tidyTime(s.opens), closes: tidyTime(s.closes) })),
    );
    const valid = closures
      .filter((c) => c.date_from.trim() && c.date_to.trim())
      .map((c) => ({ date_from: c.date_from.trim(), date_to: c.date_to.trim(), note: c.note.trim().slice(0, 120) || null }));
    if (hours.length > 42 || valid.length > 30 || hours.some((h) => !TIME.test(h.opens) || !TIME.test(h.closes))) {
      setStatus({ ok: false, text: "Please check the times. Use 24-hour time, like 09:30 or 21:00." });
      return;
    }
    if (valid.some((c) => !DATE.test(c.date_from) || !DATE.test(c.date_to))) {
      setStatus({ ok: false, text: "Please write closure dates as YYYY-MM-DD." });
      return;
    }
    if (valid.some((c) => c.date_to < c.date_from)) {
      setStatus({ ok: false, text: "A closure ends before it starts." });
      return;
    }
    setSaving(true);
    const [delHours, delClosures] = await Promise.all([
      supabase.from("opening_hours").delete().eq("listing_id", listing.id),
      supabase.from("closures").delete().eq("listing_id", listing.id),
    ]);
    if (delHours.error || delClosures.error) {
      setSaving(false);
      setStatus({ ok: false, text: SAVE_FAILED });
      return;
    }
    const [insHours, insClosures] = await Promise.all([
      hours.length
        ? supabase.from("opening_hours").insert(hours.map((x) => ({ ...x, listing_id: listing.id })))
        : Promise.resolve({ error: null }),
      valid.length
        ? supabase.from("closures").insert(valid.map((x) => ({ ...x, listing_id: listing.id })))
        : Promise.resolve({ error: null }),
    ]);
    setSaving(false);
    if (insHours.error || insClosures.error) {
      setStatus({ ok: false, text: SAVE_FAILED });
      return;
    }
    setDays(WEEKDAYS.map((_, d) => hours.filter((h) => h.weekday === d).map(({ opens, closes }) => ({ opens, closes }))));
    refreshWebsite(listing.id, "listing", locale);
    setStatus({ ok: true, text: "Hours saved." });
  }

  const timeInput = (value: string, onChange: (v: string) => void, label: string) => (
    <TextInput
      value={value}
      onChangeText={onChange}
      onEndEditing={() => onChange(tidyTime(value))}
      placeholder="09:00"
      placeholderTextColor={colors.muted}
      accessibilityLabel={label}
      keyboardType="numbers-and-punctuation"
      maxLength={5}
      style={[styles.input, { width: 84, paddingVertical: space(2), textAlign: "center" }]}
    />
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen keyboardShouldPersistTaps="handled">
        <Text style={styles.h2}>{listing.name}</Text>
        <Text style={styles.small}>24-hour time, e.g. 10:00 to 21:30. Add a second slot for a lunch break.</Text>
        {WEEKDAYS.map((name, d) => (
          <Card key={name}>
            <View style={[styles.row, { justifyContent: "space-between" }]}>
              <Text style={styles.h3}>{name}</Text>
              {d > 1 && days[1].length > 0 ? (
                <Text style={styles.link} onPress={() => setDay(d, days[1].map((x) => ({ ...x })))}>
                  Same as Monday
                </Text>
              ) : null}
            </View>
            {days[d].length === 0 ? <Text style={styles.muted}>Closed</Text> : null}
            {days[d].map((s, i) => (
              <View key={i} style={[styles.row, { gap: space(2) }]}>
                {timeInput(s.opens, (v) => setSlot(d, i, { opens: v }), `${name} opens`)}
                <Text style={styles.muted}>to</Text>
                {timeInput(s.closes, (v) => setSlot(d, i, { closes: v }), `${name} closes`)}
                <Pressable
                  onPress={() => setDay(d, days[d].filter((_, j) => j !== i))}
                  accessibilityRole="button"
                  accessibilityLabel="Remove time slot"
                  hitSlop={8}
                >
                  <Text style={{ fontSize: 18, color: colors.muted, paddingHorizontal: space(2) }}>✕</Text>
                </Pressable>
              </View>
            ))}
            <Text style={styles.link} onPress={() => setDay(d, [...days[d], { opens: "10:00", closes: "20:00" }])}>
              Add opening time
            </Text>
          </Card>
        ))}

        <Section title="Closed on dates (holidays)">
          {closures.map((c, i) => (
            <Card key={i}>
              <View style={[styles.row, { gap: space(2) }]}>
                <TextInput
                  value={c.date_from}
                  onChangeText={(v) => setClosure(i, { date_from: v })}
                  placeholder="From YYYY-MM-DD"
                  placeholderTextColor={colors.muted}
                  accessibilityLabel="Closed from"
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                  style={[styles.input, { flex: 1, paddingVertical: space(2) }]}
                />
                <TextInput
                  value={c.date_to}
                  onChangeText={(v) => setClosure(i, { date_to: v })}
                  placeholder="To YYYY-MM-DD"
                  placeholderTextColor={colors.muted}
                  accessibilityLabel="Closed until"
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                  style={[styles.input, { flex: 1, paddingVertical: space(2) }]}
                />
              </View>
              <View style={[styles.row, { gap: space(2) }]}>
                <TextInput
                  value={c.note}
                  onChangeText={(v) => setClosure(i, { note: v })}
                  placeholder="Reason, e.g. Hari Raya"
                  placeholderTextColor={colors.muted}
                  accessibilityLabel="Reason"
                  maxLength={120}
                  style={[styles.input, { flex: 1, paddingVertical: space(2) }]}
                />
                <Pressable
                  onPress={() => setClosures(closures.filter((_, j) => j !== i))}
                  accessibilityRole="button"
                  accessibilityLabel="Remove closure"
                  hitSlop={8}
                >
                  <Text style={{ fontSize: 18, color: colors.muted, paddingHorizontal: space(2) }}>✕</Text>
                </Pressable>
              </View>
            </Card>
          ))}
          <Text style={styles.link} onPress={() => setClosures([...closures, { date_from: "", date_to: "", note: "" }])}>
            Add closure
          </Text>
        </Section>

        {status ? <Notice text={status.text} tone={status.ok ? "green" : "error"} /> : null}
        <Button title="Save hours" loading={saving} onPress={save} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
