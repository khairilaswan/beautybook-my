import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Card, Chip, ErrorView, Loading, Notice, Screen, Section, styles } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { getDeals, getMallCounts, getTaxonomy } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { fmt, useI18n } from "@/lib/i18n";
import { areaName, categoryName } from "@/lib/i18n/names";
import { openWebPage, webPath } from "@/lib/links";
import { supabase } from "@/lib/supabase";
import { colors, radius, space } from "@/lib/theme";
import { useAsync } from "@/lib/use-async";

type RecentSearch = { id: number; query: string | null; category_slug: string | null; area_slug: string | null };

export default function Home() {
  const { t, locale } = useI18n();
  const { userId } = useAuth();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");

  const { data, error, loading, reload } = useAsync(
    async () => {
      const [taxonomy, deals, mallCounts, recent, memberships] = await Promise.all([
        getTaxonomy(),
        getDeals(8),
        getMallCounts(),
        userId
          ? supabase
              .from("search_history")
              .select("id, query, category_slug, area_slug")
              .order("created_at", { ascending: false })
              .limit(8)
          : Promise.resolve({ data: [] as RecentSearch[] }),
        userId
          ? supabase.from("listing_members").select("listing_id").eq("user_id", userId).limit(1)
          : Promise.resolve({ data: [] as { listing_id: string }[] }),
      ]);
      return {
        ...taxonomy,
        deals,
        mallCounts,
        recent: (recent.data ?? []) as RecentSearch[],
        isOwner: (memberships.data?.length ?? 0) > 0,
      };
    },
    [userId],
    { refetchOnFocus: true },
  );

  if (!data && loading) return <Loading />;
  if (!data) return <ErrorView onRetry={reload} />;

  const explore = (params: Record<string, string>) => router.navigate({ pathname: "/explore", params });
  const cities = data.areas.filter((a) => a.type === "city");
  const malls = data.malls
    .map((m) => ({ ...m, count: data.mallCounts.get(m.slug) ?? 0 }))
    .filter((m) => m.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // A remembered search, shown the way the website shows it.
  const recentLabel = (s: RecentSearch) => {
    const cat = data.categories.find((c) => c.slug === s.category_slug);
    const area = data.areas.find((a) => a.slug === s.area_slug);
    return [s.query, cat ? categoryName(cat, locale) : null, area ? areaName(area, locale) : null].filter(Boolean).join(" · ");
  };

  return (
    <Screen refreshing={loading} onRefresh={reload} contentStyle={{ paddingTop: insets.top + space(4) }}>
      {error ? <Notice text={t.common.offline} tone="error" /> : null}
      <View style={{ gap: space(3) }}>
        <Text style={[styles.h1, { color: colors.brand600, fontSize: 22 }]}>BeautyBook</Text>
        <Text style={styles.h1} accessibilityRole="header">
          {t.home.title}
        </Text>
        <View style={[styles.row, { gap: space(2) }]}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={t.home.searchPlaceholder}
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            onSubmitEditing={() => explore({ q: q.trim() })}
            accessibilityLabel={t.home.searchPlaceholder}
            style={[styles.input, { flex: 1 }]}
          />
          <Button title="→" accessibilityLabel={t.search.title} onPress={() => explore({ q: q.trim() })} style={{ width: 52 }} />
        </View>
        <View style={styles.wrap}>
          <Chip label={`📍 ${t.home.nearMe}`} onPress={() => explore({ near: "1" })} />
          <Chip label={t.common.openNow} onPress={() => explore({ open: "1" })} />
        </View>
      </View>

      {data.isOwner ? <Button title={t.account.myBusiness} variant="brand" onPress={() => router.push("/owner")} /> : null}

      {data.recent.length > 0 ? (
        <Section title={t.home.recent}>
          <View style={styles.wrap}>
            {data.recent.map((s) => (
              <Chip
                key={s.id}
                label={recentLabel(s) || "…"}
                onPress={() =>
                  explore({
                    ...(s.query ? { q: s.query } : {}),
                    ...(s.category_slug ? { category: s.category_slug } : {}),
                    ...(s.area_slug ? { area: s.area_slug } : {}),
                  })
                }
              />
            ))}
          </View>
        </Section>
      ) : null}

      <Section title={t.home.browseByService}>
        <View style={styles.wrap}>
          {data.categories.map((c) => (
            <Chip key={c.slug} label={categoryName(c, locale)} onPress={() => explore({ category: c.slug })} />
          ))}
        </View>
      </Section>

      <Section title={t.home.browseByArea}>
        <View style={styles.wrap}>
          {cities.map((a) => (
            <Chip key={a.slug} label={areaName(a, locale)} onPress={() => explore({ area: a.slug })} />
          ))}
        </View>
      </Section>

      {data.deals.length > 0 ? (
        <Section title={t.home.deals}>
          {data.deals.map((d) => (
            <Card key={d.id} onPress={() => router.push({ pathname: "/salon/[slug]", params: { slug: d.listing.slug } })}>
              <Text style={styles.h3}>{d.title}</Text>
              <Text style={styles.muted}>
                {[d.listing.name, d.price_label, fmt(t.home.until, { date: formatDate(d.ends_on, locale) })].filter(Boolean).join(" · ")}
              </Text>
            </Card>
          ))}
        </Section>
      ) : null}

      {malls.length > 0 ? (
        <Section
          title={t.home.malls}
          right={
            <Pressable accessibilityRole="link" onPress={() => router.push("/malls")}>
              <Text style={styles.link}>{t.common.seeAll}</Text>
            </Pressable>
          }
        >
          <View style={styles.wrap}>
            {malls.map((m) => (
              <Chip key={m.slug} label={`${m.name} (${m.count})`} onPress={() => explore({ mall: m.slug })} />
            ))}
          </View>
        </Section>
      ) : null}

      <View style={{ backgroundColor: colors.ink, borderRadius: radius.lg, padding: space(5), gap: space(2) }}>
        <Text style={[styles.h3, { color: colors.white }]}>{t.home.ownerTitle}</Text>
        <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 14, lineHeight: 20 }}>{t.home.ownerBody}</Text>
        <Button
          title={t.home.ownerCta}
          variant="outline"
          small
          style={{ alignSelf: "flex-start", marginTop: space(2) }}
          onPress={() => openWebPage(webPath(locale, "/for-business"))}
        />
      </View>
    </Screen>
  );
}
