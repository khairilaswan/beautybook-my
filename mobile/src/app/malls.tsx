import { Stack, router } from "expo-router";
import { useState } from "react";
import { FlatList, Text, TextInput, View } from "react-native";
import { Card, Empty, ErrorView, Loading, styles } from "@/components/ui";
import { getMallCounts, getTaxonomy } from "@/lib/data";
import { fmt, useI18n } from "@/lib/i18n";
import { areaName } from "@/lib/i18n/names";
import { colors, space } from "@/lib/theme";
import { useAsync } from "@/lib/use-async";

// Every shopping mall with at least one listed shop, busiest first.
export default function Malls() {
  const { t, locale } = useI18n();
  const [q, setQ] = useState("");
  const { data, loading, reload } = useAsync(async () => {
    const [{ malls, areas }, counts] = await Promise.all([getTaxonomy(), getMallCounts()]);
    return malls
      .map((m) => ({
        ...m,
        count: counts.get(m.slug) ?? 0,
        area: areas.find((a) => a.id === m.area_id) ?? null,
      }))
      .filter((m) => m.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, []);

  if (!data && loading) return <Loading />;
  if (!data) return <ErrorView onRetry={reload} />;

  const needle = q.trim().toLowerCase();
  const shown = needle ? data.filter((m) => m.name.toLowerCase().includes(needle)) : data;

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen options={{ title: t.home.malls }} />
      <FlatList
        data={shown}
        keyExtractor={(m) => m.slug}
        contentContainerStyle={{ padding: space(4), gap: space(3) }}
        keyboardShouldPersistTaps="handled"
        refreshing={loading}
        onRefresh={reload}
        ListHeaderComponent={
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={t.search.mall}
            placeholderTextColor={colors.muted}
            accessibilityLabel={t.search.mall}
            style={styles.input}
          />
        }
        ListEmptyComponent={<Empty title={t.search.noneTitle} />}
        renderItem={({ item }) => (
          <Card onPress={() => router.navigate({ pathname: "/explore", params: { mall: item.slug } })}>
            <Text style={styles.h3}>{item.name}</Text>
            <Text style={styles.muted}>
              {[item.area ? areaName(item.area, locale) : null, item.count === 1 ? t.search.countOne : fmt(t.search.countMany, { count: item.count })]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </Card>
        )}
      />
    </View>
  );
}
