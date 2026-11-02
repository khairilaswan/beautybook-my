import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { Button, Chip, Empty, ErrorView, Field, Loading, Notice, Screen, Section, styles } from "@/components/ui";
import { refreshWebsite } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getTaxonomy } from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { openWebPage, webPath } from "@/lib/links";
import { type OwnerListing, SAVE_FAILED, loadOwnerListing } from "@/lib/owner";
import { supabase } from "@/lib/supabase";
import type { Attribute, Mall } from "@/lib/types";
import { useAsync } from "@/lib/use-async";

const PRICE_LEVELS = [
  { value: "", label: "Not set" },
  { value: "1", label: "$ Budget" },
  { value: "2", label: "$$ Mid-range" },
  { value: "3", label: "$$$ Premium" },
  { value: "4", label: "$$$$ Luxury" },
];
const GENDERS = [
  { value: "", label: "Not set" },
  { value: "men", label: "Men" },
  { value: "women", label: "Women" },
  { value: "unisex", label: "Men and women" },
];

export default function OwnerDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();
  const { data, loading, reload } = useAsync(async () => {
    const listing = await loadOwnerListing(id, userId);
    if (!listing) return null;
    const [{ attributes, malls }, attrs] = await Promise.all([
      getTaxonomy(),
      supabase.from("listing_attributes").select("attribute_id").eq("listing_id", id),
    ]);
    if (attrs.error) throw attrs.error;
    return { listing, attributes, malls, selected: (attrs.data ?? []).map((a) => a.attribute_id as number) };
  }, [id, userId]);

  if (data === undefined) return loading ? <Loading /> : <ErrorView onRetry={reload} />;
  if (data === null) return <Empty title="You don't manage this business." />;
  return <DetailsForm {...data} />;
}

const isUrl = (v: string) => v === "" || /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(v);

function DetailsForm({
  listing,
  attributes,
  malls,
  selected,
}: {
  listing: OwnerListing;
  attributes: Attribute[];
  malls: Mall[];
  selected: number[];
}) {
  const { locale } = useI18n();
  const [description, setDescription] = useState(listing.description ?? "");
  const [instagram, setInstagram] = useState(listing.instagram ?? "");
  const [facebook, setFacebook] = useState(listing.facebook ?? "");
  const [website, setWebsite] = useState(listing.website ?? "");
  const [mallId, setMallId] = useState<number | null>(listing.mall_id);
  const [mallQuery, setMallQuery] = useState("");
  const [priceLevel, setPriceLevel] = useState(listing.price_level ? String(listing.price_level) : "");
  const [gender, setGender] = useState(listing.gender ?? "");
  const [attrs, setAttrs] = useState<number[]>(selected);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const sortedMalls = [...malls].sort((a, b) => a.name.localeCompare(b.name));
  const needle = mallQuery.trim().toLowerCase();
  const mallMatches = needle ? sortedMalls.filter((m) => m.name.toLowerCase().includes(needle)).slice(0, 12) : [];
  const currentMall = malls.find((m) => m.id === mallId) ?? null;

  async function save() {
    setStatus(null);
    const links = { instagram: instagram.trim(), facebook: facebook.trim(), website: website.trim() };
    if (!Object.values(links).every(isUrl)) {
      setStatus({ ok: false, text: "Please check the links are full addresses starting with https://" });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("listings")
      .update({
        mall_id: mallId,
        description: description.trim().slice(0, 2000) || null,
        website: links.website || null,
        instagram: links.instagram || null,
        facebook: links.facebook || null,
        price_level: priceLevel ? Number(priceLevel) : null,
        gender: gender || null,
      })
      .eq("id", listing.id);
    if (error) {
      setSaving(false);
      setStatus({ ok: false, text: SAVE_FAILED });
      return;
    }
    const del = await supabase.from("listing_attributes").delete().eq("listing_id", listing.id);
    let attrError = !!del.error;
    if (!del.error && attrs.length) {
      const ins = await supabase
        .from("listing_attributes")
        .insert(attrs.map((attribute_id) => ({ listing_id: listing.id, attribute_id })));
      attrError = !!ins.error;
    }
    setSaving(false);
    refreshWebsite(listing.id, "listing", locale);
    setStatus(attrError ? { ok: false, text: "Details saved, but the 'Good to know' tags could not be saved." } : { ok: true, text: "Saved." });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen keyboardShouldPersistTaps="handled">
        <Text style={styles.h2}>{listing.name}</Text>
        <Field
          label="About your shop"
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={2000}
          style={{ minHeight: 120, textAlignVertical: "top" }}
        />
        <Field label="Instagram" value={instagram} onChangeText={setInstagram} placeholder="https://" keyboardType="url" autoCapitalize="none" autoCorrect={false} />
        <Field label="Facebook" value={facebook} onChangeText={setFacebook} placeholder="https://" keyboardType="url" autoCapitalize="none" autoCorrect={false} />
        <Field label="Website" value={website} onChangeText={setWebsite} placeholder="https://" keyboardType="url" autoCapitalize="none" autoCorrect={false} />

        {malls.length > 0 ? (
          <Section title="Shopping mall">
            <View style={styles.wrap}>
              <Chip label="Not in a mall" selected={mallId === null} onPress={() => setMallId(null)} />
              {currentMall ? <Chip label={currentMall.name} selected onPress={() => undefined} /> : null}
            </View>
            <Field label="Find your mall" value={mallQuery} onChangeText={setMallQuery} placeholder="e.g. Mid Valley" />
            <View style={styles.wrap}>
              {mallMatches.map((m) => (
                <Chip
                  key={m.id}
                  label={m.name}
                  selected={mallId === m.id}
                  onPress={() => {
                    setMallId(m.id);
                    setMallQuery("");
                  }}
                />
              ))}
            </View>
          </Section>
        ) : null}

        <Section title="Price level">
          <View style={styles.wrap}>
            {PRICE_LEVELS.map((p) => (
              <Chip key={p.value} label={p.label} selected={priceLevel === p.value} onPress={() => setPriceLevel(p.value)} />
            ))}
          </View>
        </Section>

        <Section title="Customers">
          <View style={styles.wrap}>
            {GENDERS.map((g) => (
              <Chip key={g.value} label={g.label} selected={gender === g.value} onPress={() => setGender(g.value)} />
            ))}
          </View>
        </Section>

        <Section title="Good to know">
          <View style={styles.wrap}>
            {attributes.map((a) => (
              <Chip
                key={a.id}
                label={a.name_en}
                selected={attrs.includes(a.id)}
                onPress={() => setAttrs(attrs.includes(a.id) ? attrs.filter((x) => x !== a.id) : [...attrs, a.id])}
              />
            ))}
          </View>
        </Section>

        {status ? <Notice text={status.text} tone={status.ok ? "green" : "error"} /> : null}
        <Button title="Save details" loading={saving} onPress={save} />
        <Text style={styles.small}>
          To change the shop name, address or phone number, send us a correction.
        </Text>
        <Button
          title="Send a correction"
          variant="ghost"
          small
          style={{ alignSelf: "flex-start" }}
          onPress={() => openWebPage(webPath(locale, `/salon/${listing.slug}/report`))}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}
