import * as Location from "expo-location";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ListingCard } from "@/components/listing-card";
import { Button, Chip, Empty, ErrorView, Notice, Section, styles } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { PAGE_SIZE, getTaxonomy, searchListings } from "@/lib/data";
import { fmt, useI18n } from "@/lib/i18n";
import { areaName, attributeName, categoryName } from "@/lib/i18n/names";
import { supabase } from "@/lib/supabase";
import { colors, space } from "@/lib/theme";
import type { Area, Attribute, Category, ListingCard as Card, Mall, SearchParams } from "@/lib/types";
import { useAsync } from "@/lib/use-async";

const RADIUS_OPTIONS = [2, 5, 10, 25];
const PRICE_OPTIONS = [30, 50, 100, 200, 500];

type Filters = Omit<SearchParams, "page" | "pageSize" | "slugs">;

type RouteParams = { q?: string; category?: string; area?: string; mall?: string; near?: string; open?: string };

function filtersFromParams(p: RouteParams): Filters {
  return {
    q: p.q || undefined,
    category: p.category || undefined,
    area: p.area || undefined,
    mall: p.mall || undefined,
    openNow: p.open === "1",
  };
}

export default function Explore() {
  const { t, locale } = useI18n();
  const { userId } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<RouteParams>();
  const taxonomy = useAsync(() => getTaxonomy(), []);

  const [filters, setFilters] = useState<Filters>(() => filtersFromParams(params));
  const [query, setQuery] = useState(params.q ?? "");
  const [showFilters, setShowFilters] = useState(false);
  // A fresh filter sheet (starting from the current filters) each time it opens.
  const [sheetKey, setSheetKey] = useState(0);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(false);

  const [items, setItems] = useState<Card[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const run = useRef(0);

  // Coming from Home (a category, an area, "near me"): start from those.
  const paramKey = JSON.stringify(params);
  const [seenParams, setSeenParams] = useState(paramKey);
  if (seenParams !== paramKey) {
    setSeenParams(paramKey);
    setFilters(filtersFromParams(params));
    setQuery(params.q ?? "");
  }
  useEffect(() => {
    if (params.near === "1") void locate();
    // Only when the route's params change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramKey]);

  const load = useCallback(
    async (nextPage: number) => {
      const id = ++run.current;
      if (nextPage === 1) setLoading(true);
      else setLoadingMore(true);
      try {
        const res = await searchListings({ ...filters, page: nextPage, pageSize: PAGE_SIZE });
        if (id !== run.current) return;
        setItems((prev) => (nextPage === 1 ? res.items : [...prev, ...res.items]));
        setTotal(res.total);
        setPage(nextPage);
        setError(false);
      } catch (e) {
        console.warn("search failed", e);
        if (id === run.current) setError(true);
      } finally {
        if (id === run.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [filters],
  );

  useEffect(() => {
    // Loading results whenever the filters change is what this effect is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(1);
  }, [load]);

  // Remember searches for signed-in members, as the website does.
  useEffect(() => {
    if (!userId || (!filters.q && !filters.category && !filters.area)) return;
    void supabase
      .from("search_history")
      .insert({
        user_id: userId,
        query: filters.q?.slice(0, 100) ?? null,
        category_slug: filters.category ?? null,
        area_slug: filters.area ?? null,
      })
      .then(() => {});
  }, [userId, filters.q, filters.category, filters.area]);

  async function locate() {
    setLocating(true);
    setLocationError(false);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError(true);
        return;
      }
      const pos =
        (await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 })) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      // Rounded to about 100 m, like the website.
      const near = {
        lat: Math.round(pos.coords.latitude * 1000) / 1000,
        lng: Math.round(pos.coords.longitude * 1000) / 1000,
      };
      setFilters((f) => ({ ...f, near, radiusKm: f.radiusKm ?? 10, area: undefined, mall: undefined, sort: "distance" }));
    } catch {
      setLocationError(true);
    } finally {
      setLocating(false);
    }
  }

  const tax = taxonomy.data;
  const summary = useMemo(() => {
    if (!tax) return [];
    const parts: string[] = [];
    const cat = tax.categories.find((c) => c.slug === filters.category);
    if (cat) parts.push(categoryName(cat, locale));
    const area = tax.areas.find((a) => a.slug === filters.area);
    if (area) parts.push(areaName(area, locale));
    const mall = tax.malls.find((m) => m.slug === filters.mall);
    if (mall) parts.push(mall.name);
    if (filters.near) parts.push(fmt(t.search.within, { km: filters.radiusKm ?? 10 }));
    if (filters.openNow) parts.push(t.common.openNow);
    if (filters.openLate) parts.push(t.search.openLate);
    if (filters.gender) parts.push(t.common.gender[filters.gender]);
    if (filters.maxPrice) parts.push(fmt(t.search.under, { price: `RM${filters.maxPrice}` }));
    for (const slug of filters.attributes ?? []) {
      const a = tax.attributes.find((x) => x.slug === slug);
      if (a) parts.push(attributeName(a, locale));
    }
    return parts;
  }, [tax, filters, locale, t]);

  const header = (
    <View style={{ gap: space(3), paddingBottom: space(3) }}>
      <Text style={styles.h1} accessibilityRole="header">
        {t.search.title}
      </Text>
      <View style={[styles.row, { gap: space(2) }]}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t.search.placeholder}
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          clearButtonMode="while-editing"
          onSubmitEditing={() => setFilters((f) => ({ ...f, q: query.trim() || undefined }))}
          accessibilityLabel={t.search.placeholder}
          style={[styles.input, { flex: 1 }]}
        />
        <Button title={t.search.filters} variant="outline" onPress={() => {
            setSheetKey((k) => k + 1);
            setShowFilters(true);
          }} />
      </View>
      <View style={styles.wrap}>
        <Chip
          label={locating ? t.search.finding : `📍 ${t.search.nearMe}`}
          selected={!!filters.near}
          onPress={() => (filters.near ? setFilters((f) => ({ ...f, near: undefined, radiusKm: undefined, sort: undefined })) : void locate())}
        />
        <Chip label={t.common.openNow} selected={!!filters.openNow} onPress={() => setFilters((f) => ({ ...f, openNow: !f.openNow }))} />
        {summary.length > 0 ? (
          <Chip
            label={`✕ ${t.common.clear}`}
            onPress={() => {
              setQuery("");
              setFilters({});
            }}
          />
        ) : null}
      </View>
      {locationError ? <Notice text={t.search.locationDenied} tone="error" /> : null}
      {summary.length > 0 ? <Text style={styles.muted}>{summary.join(" · ")}</Text> : null}
      {!loading && !error ? (
        <Text style={styles.h3}>{total === 1 ? t.search.countOne : fmt(t.search.countMany, { count: total })}</Text>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <FlatList
        data={items}
        keyExtractor={(l) => l.id}
        contentContainerStyle={{ padding: space(4), paddingTop: insets.top + space(4), paddingBottom: space(16), gap: space(3) }}
        ListHeaderComponent={header}
        renderItem={({ item }) => <ListingCard listing={item} categories={tax?.categories ?? []} />}
        keyboardShouldPersistTaps="handled"
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (!loading && !loadingMore && items.length < total) void load(page + 1);
        }}
        refreshing={false}
        onRefresh={() => load(1)}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.brand600} style={{ marginTop: space(10) }} />
          ) : error ? (
            <ErrorView onRetry={() => load(1)} />
          ) : (
            <Empty title={t.search.noneTitle} body={t.search.noneBody} />
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.brand600} style={{ margin: space(4) }} /> : undefined}
      />
      {tax ? (
        <FiltersSheet
          key={sheetKey}
          visible={showFilters}
          initial={filters}
          categories={tax.categories}
          areas={tax.areas}
          malls={tax.malls}
          attributes={tax.attributes}
          onClose={() => setShowFilters(false)}
          onApply={(next) => {
            setFilters({ ...next, q: query.trim() || undefined });
            setShowFilters(false);
          }}
        />
      ) : null}
    </View>
  );
}

function FiltersSheet({
  visible,
  initial,
  categories,
  areas,
  malls,
  attributes,
  onClose,
  onApply,
}: {
  visible: boolean;
  initial: Filters;
  categories: Category[];
  areas: Area[];
  malls: Mall[];
  attributes: Attribute[];
  onClose: () => void;
  onApply: (f: Filters) => void;
}) {
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const [f, setF] = useState<Filters>(initial);

  const cities = areas.filter((a) => a.type === "city");
  const selectedArea = areas.find((a) => a.slug === f.area);
  // The city whose neighbourhoods are shown: the chosen city, or the chosen area's city.
  const openCity = selectedArea ? (selectedArea.type === "city" ? selectedArea : areas.find((a) => a.id === selectedArea.parent_id)) : null;
  const neighbourhoods = openCity ? areas.filter((a) => a.parent_id === openCity.id) : [];
  const attrs = (f.attributes ?? []) as string[];
  const groups: Attribute["group_name"][] = ["audience", "language", "service_mode", "amenity"];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.canvas }}>
        <View style={[styles.sectionHeader, { padding: space(4), paddingTop: space(4) }]}>
          <Pressable accessibilityRole="button" onPress={onClose}>
            <Text style={styles.link}>{t.common.cancel}</Text>
          </Pressable>
          <Text style={styles.h3}>{t.search.filters}</Text>
          <Pressable accessibilityRole="button" onPress={() => setF({})}>
            <Text style={styles.link}>{t.common.clear}</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: space(4), gap: space(6), paddingBottom: space(8) }}>
          <Section title={t.search.service}>
            <View style={styles.wrap}>
              <Chip label={t.search.allServices} selected={!f.category} onPress={() => setF({ ...f, category: undefined })} />
              {categories.map((c) => (
                <Chip
                  key={c.slug}
                  label={categoryName(c, locale)}
                  selected={f.category === c.slug}
                  onPress={() => setF({ ...f, category: c.slug })}
                />
              ))}
            </View>
          </Section>

          <Section title={t.search.area}>
            <View style={styles.wrap}>
              <Chip
                label={t.search.allAreas}
                selected={!f.area && !f.near}
                onPress={() => setF({ ...f, area: undefined, near: undefined, radiusKm: undefined })}
              />
              {cities.map((a) => (
                <Chip
                  key={a.slug}
                  label={areaName(a, locale)}
                  selected={openCity?.id === a.id}
                  onPress={() => setF({ ...f, area: a.slug, mall: undefined, near: undefined, radiusKm: undefined, sort: f.sort === "distance" ? undefined : f.sort })}
                />
              ))}
            </View>
            {neighbourhoods.length > 0 ? (
              <View style={[styles.wrap, { marginTop: space(1) }]}>
                {neighbourhoods.map((a) => (
                  <Chip key={a.slug} label={areaName(a, locale)} selected={f.area === a.slug} onPress={() => setF({ ...f, area: a.slug })} />
                ))}
              </View>
            ) : null}
          </Section>

          {f.near ? (
            <Section title={t.search.nearMe}>
              <View style={styles.wrap}>
                {RADIUS_OPTIONS.map((km) => (
                  <Chip key={km} label={fmt(t.search.within, { km })} selected={(f.radiusKm ?? 10) === km} onPress={() => setF({ ...f, radiusKm: km })} />
                ))}
              </View>
            </Section>
          ) : null}

          {malls.length > 0 ? (
            <Section title={t.search.mall}>
              <View style={styles.wrap}>
                <Chip label={t.search.anyMall} selected={!f.mall} onPress={() => setF({ ...f, mall: undefined })} />
                {malls.map((m) => (
                  <Chip
                    key={m.slug}
                    label={m.name}
                    selected={f.mall === m.slug}
                    onPress={() => setF({ ...f, mall: m.slug, area: undefined, near: undefined, radiusKm: undefined, sort: f.sort === "distance" ? undefined : f.sort })}
                  />
                ))}
              </View>
            </Section>
          ) : null}

          <Section title={t.search.for}>
            <View style={styles.wrap}>
              <Chip label={t.common.any} selected={!f.gender} onPress={() => setF({ ...f, gender: undefined })} />
              <Chip label={t.common.gender.men} selected={f.gender === "men"} onPress={() => setF({ ...f, gender: "men" })} />
              <Chip label={t.common.gender.women} selected={f.gender === "women"} onPress={() => setF({ ...f, gender: "women" })} />
            </View>
            <View style={styles.wrap}>
              <Chip label={t.common.openNow} selected={!!f.openNow} onPress={() => setF({ ...f, openNow: !f.openNow })} />
              <Chip label={t.search.openLate} selected={!!f.openLate} onPress={() => setF({ ...f, openLate: !f.openLate })} />
            </View>
          </Section>

          <Section title={t.search.maxPrice}>
            <View style={styles.wrap}>
              <Chip label={t.common.any} selected={!f.maxPrice} onPress={() => setF({ ...f, maxPrice: undefined })} />
              {PRICE_OPTIONS.map((n) => (
                <Chip key={n} label={fmt(t.search.under, { price: `RM${n}` })} selected={f.maxPrice === n} onPress={() => setF({ ...f, maxPrice: n })} />
              ))}
            </View>
          </Section>

          <Section title={t.search.sort}>
            <View style={styles.wrap}>
              <Chip label={t.search.bestMatch} selected={!f.sort} onPress={() => setF({ ...f, sort: undefined })} />
              <Chip label={t.search.lowestPrice} selected={f.sort === "price"} onPress={() => setF({ ...f, sort: "price" })} />
              {f.near ? <Chip label={t.search.nearest} selected={f.sort === "distance"} onPress={() => setF({ ...f, sort: "distance" })} /> : null}
            </View>
          </Section>

          {groups.map((g) => {
            const list = attributes.filter((a) => a.group_name === g);
            if (list.length === 0) return null;
            return (
              <Section key={g} title={t.search.groups[g]}>
                <View style={styles.wrap}>
                  {list.map((a) => {
                    const on = attrs.includes(a.slug);
                    return (
                      <Chip
                        key={a.slug}
                        label={attributeName(a, locale)}
                        selected={on}
                        onPress={() =>
                          setF({ ...f, attributes: on ? attrs.filter((x) => x !== a.slug) : [...attrs, a.slug].slice(0, 10) })
                        }
                      />
                    );
                  })}
                </View>
              </Section>
            );
          })}
        </ScrollView>
        <View style={{ padding: space(4), paddingBottom: insets.bottom + space(4), borderTopWidth: 1, borderTopColor: colors.line }}>
          <Button title={t.common.apply} onPress={() => onApply(f)} />
        </View>
      </View>
    </Modal>
  );
}
