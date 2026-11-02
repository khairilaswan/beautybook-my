import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { Button, Card, Empty, ErrorView, Loading, Notice, Screen, styles } from "@/components/ui";
import { refreshWebsite } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { type OwnerListing, SAVE_FAILED, loadOwnerListing } from "@/lib/owner";
import { supabase } from "@/lib/supabase";
import { colors, space } from "@/lib/theme";
import { useAsync } from "@/lib/use-async";

type ServiceRow = { name: string; price_from: string; price_to: string; duration_min: string };
type Service = { name: string; price_from: number | null; price_to: number | null; duration_min: number | null };

export default function OwnerMenu() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();
  const { data, loading, reload } = useAsync(async () => {
    const listing = await loadOwnerListing(id, userId);
    if (!listing) return null;
    const { data: services, error } = await supabase
      .from("services")
      .select("name, price_from, price_to, duration_min")
      .eq("listing_id", id)
      .order("sort_order");
    if (error) throw error;
    return { listing, services: (services ?? []) as Service[] };
  }, [id, userId]);

  if (data === undefined) return loading ? <Loading /> : <ErrorView onRetry={reload} />;
  if (data === null) return <Empty title="You don't manage this business." />;
  return <MenuEditor listing={data.listing} initial={data.services} />;
}

const toNumber = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

function MenuEditor({ listing, initial }: { listing: OwnerListing; initial: Service[] }) {
  const { locale } = useI18n();
  const [rows, setRows] = useState<ServiceRow[]>(
    initial.map((s) => ({
      name: s.name,
      price_from: s.price_from?.toString() ?? "",
      price_to: s.price_to?.toString() ?? "",
      duration_min: s.duration_min?.toString() ?? "",
    })),
  );
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const setRow = (i: number, patch: Partial<ServiceRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  // Same checks as the website before replacing the whole menu.
  async function save() {
    setStatus(null);
    const payload = rows
      .filter((r) => r.name.trim())
      .map((r) => ({
        name: r.name.trim().slice(0, 120),
        price_from: toNumber(r.price_from),
        price_to: toNumber(r.price_to),
        duration_min: toNumber(r.duration_min),
      }));
    if (payload.some((p) => [p.price_from, p.price_to, p.duration_min].some((n) => n !== null && Number.isNaN(n)))) {
      setStatus({ ok: false, text: "Prices and minutes must be numbers." });
      return;
    }
    if (
      payload.length > 60 ||
      payload.some(
        (p) =>
          (p.price_from !== null && (p.price_from < 0 || p.price_from > 100000)) ||
          (p.price_to !== null && (p.price_to < 0 || p.price_to > 100000)) ||
          (p.duration_min !== null && (!Number.isInteger(p.duration_min) || p.duration_min < 5 || p.duration_min > 1440)),
      )
    ) {
      setStatus({ ok: false, text: "Each service needs a name; prices must be numbers and minutes between 5 and 1440." });
      return;
    }
    if (payload.some((p) => p.price_to !== null && p.price_from !== null && p.price_to < p.price_from)) {
      setStatus({ ok: false, text: "A price range ends lower than it starts." });
      return;
    }
    setSaving(true);
    const del = await supabase.from("services").delete().eq("listing_id", listing.id);
    if (del.error) {
      setSaving(false);
      setStatus({ ok: false, text: SAVE_FAILED });
      return;
    }
    if (payload.length) {
      const { error } = await supabase
        .from("services")
        .insert(payload.map((s, i) => ({ ...s, listing_id: listing.id, sort_order: (i + 1) * 10 })));
      if (error) {
        setSaving(false);
        setStatus({ ok: false, text: SAVE_FAILED });
        return;
      }
    }
    setSaving(false);
    refreshWebsite(listing.id, "listing", locale);
    setStatus({ ok: true, text: "Menu saved." });
  }

  const input = [styles.input, { paddingVertical: space(2) }];
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen keyboardShouldPersistTaps="handled">
        <Text style={styles.h2}>{listing.name}</Text>
        {rows.length === 0 ? (
          <Text style={styles.muted}>No services yet. Customers see a standard menu until you add yours.</Text>
        ) : null}
        {rows.map((r, i) => (
          <Card key={i}>
            <View style={[styles.row, { gap: space(2) }]}>
              <TextInput
                value={r.name}
                onChangeText={(v) => setRow(i, { name: v })}
                placeholder="Service name"
                placeholderTextColor={colors.muted}
                accessibilityLabel="Service name"
                maxLength={120}
                style={[...input, { flex: 1 }]}
              />
              <Pressable
                onPress={() => setRows(rows.filter((_, j) => j !== i))}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${r.name || "service"}`}
                hitSlop={8}
              >
                <Text style={{ fontSize: 18, color: colors.muted, paddingHorizontal: space(2) }}>✕</Text>
              </Pressable>
            </View>
            <View style={[styles.row, { gap: space(2) }]}>
              <TextInput
                value={r.price_from}
                onChangeText={(v) => setRow(i, { price_from: v })}
                placeholder="RM from"
                placeholderTextColor={colors.muted}
                accessibilityLabel="Price from (RM)"
                keyboardType="decimal-pad"
                style={[...input, { flex: 1 }]}
              />
              <TextInput
                value={r.price_to}
                onChangeText={(v) => setRow(i, { price_to: v })}
                placeholder="RM to"
                placeholderTextColor={colors.muted}
                accessibilityLabel="Price to (RM, optional)"
                keyboardType="decimal-pad"
                style={[...input, { flex: 1 }]}
              />
              <TextInput
                value={r.duration_min}
                onChangeText={(v) => setRow(i, { duration_min: v.replace(/[^0-9]/g, "") })}
                placeholder="Min"
                placeholderTextColor={colors.muted}
                accessibilityLabel="Minutes"
                keyboardType="number-pad"
                style={[...input, { flex: 1 }]}
              />
            </View>
          </Card>
        ))}
        <Button
          title="Add service"
          variant="outline"
          onPress={() => setRows([...rows, { name: "", price_from: "", price_to: "", duration_min: "" }])}
        />
        {status ? <Notice text={status.text} tone={status.ok ? "green" : "error"} /> : null}
        <Button title="Save menu" loading={saving} onPress={save} />
        <Text style={styles.small}>Saving replaces your whole menu with this list.</Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}
