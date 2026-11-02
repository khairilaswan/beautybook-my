import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Pill } from "@/components/ui";
import { priceRangeLabel } from "@/lib/format";
import { fmt, useI18n } from "@/lib/i18n";
import { categoryName } from "@/lib/i18n/names";
import { photoUrl } from "@/lib/supabase";
import { colors, radius, shadow, space } from "@/lib/theme";
import type { Category, ListingCard as Card } from "@/lib/types";

export function ListingCard({ listing, categories }: { listing: Card; categories: Category[] }) {
  const { t, locale } = useI18n();
  const category = categories.find((c) => c.slug === listing.primary_category);
  const price = priceRangeLabel(listing.min_price, listing.max_price, locale);
  const where = [listing.mall_name, listing.area_name].filter(Boolean).join(", ");
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={listing.name}
      onPress={() => router.push({ pathname: "/salon/[slug]", params: { slug: listing.slug } })}
      style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}
    >
      <View style={s.photo}>
        {listing.cover_path ? (
          <Image source={photoUrl(listing.cover_path)} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        ) : (
          <Text style={s.initial}>{listing.name.slice(0, 1).toUpperCase()}</Text>
        )}
      </View>
      <View style={s.body}>
        <Text style={s.name} numberOfLines={1}>
          {listing.name}
        </Text>
        <Text style={s.meta} numberOfLines={1}>
          {[category ? categoryName(category, locale) : null, where].filter(Boolean).join(" · ")}
        </Text>
        <View style={s.tags}>
          <Pill label={listing.open_now ? t.common.openNow : t.common.closedNow} tone={listing.open_now ? "green" : "plain"} />
          {listing.rating_count > 0 && listing.rating_avg !== null ? (
            <Pill label={`★ ${listing.rating_avg} (${listing.rating_count})`} />
          ) : null}
          {listing.is_featured ? <Pill label={t.search.featured} tone="brand" /> : null}
          {listing.has_deal ? <Pill label={t.search.deal} tone="brand" /> : null}
          {listing.distance_km !== null ? (
            <Pill label={fmt(t.search.kmAway, { km: listing.distance_km.toFixed(1) })} />
          ) : null}
        </View>
        {price ? <Text style={s.price}>{price}</Text> : null}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
    ...shadow,
  },
  photo: {
    width: 96,
    minHeight: 104,
    backgroundColor: colors.brand50,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { fontSize: 32, fontWeight: "700", color: colors.brand600 },
  body: { flex: 1, padding: space(3), gap: space(1) },
  name: { fontSize: 16, fontWeight: "600", color: colors.ink },
  meta: { fontSize: 13, color: colors.muted },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space(1), marginTop: space(0.5) },
  price: { fontSize: 13, fontWeight: "600", color: colors.ink, marginTop: space(0.5) },
});
