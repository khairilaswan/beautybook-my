import { router } from "expo-router";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Card, Empty, ErrorView, Loading, Screen, Section, styles } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { space } from "@/lib/theme";
import { useAsync } from "@/lib/use-async";

type ListingRef = { id: string; slug: string; name: string } | null;

export default function Saved() {
  const { t } = useI18n();
  const { userId } = useAuth();
  const insets = useSafeAreaInsets();

  const { data, error, loading, reload } = useAsync(
    async () => {
      if (!userId) return null;
      const [favourites, notes] = await Promise.all([
        supabase.from("favourites").select("created_at, listings ( id, slug, name )").order("created_at", { ascending: false }),
        supabase.from("notes").select("body, updated_at, listings ( id, slug, name )").order("updated_at", { ascending: false }),
      ]);
      if (favourites.error) throw favourites.error;
      return {
        favourites: (favourites.data ?? []).map((f) => (f as unknown as { listings: ListingRef }).listings).filter((l) => !!l),
        notes: (notes.data ?? [])
          .map((n) => ({ body: n.body as string, listing: (n as unknown as { listings: ListingRef }).listings }))
          .filter((n) => !!n.listing),
      };
    },
    [userId],
    { refetchOnFocus: true },
  );

  const top = { paddingTop: insets.top + space(4) };
  if (!userId) {
    return (
      <Screen contentStyle={top}>
        <Text style={styles.h1}>{t.saved.title}</Text>
        <Empty title={t.login.lead}>
          <Button title={t.login.signIn} onPress={() => router.push("/login")} style={{ marginTop: space(4) }} />
        </Empty>
      </Screen>
    );
  }
  if (!data && loading) return <Loading />;
  if (!data) return <ErrorView onRetry={reload} />;
  if (error) return <ErrorView onRetry={reload} />;

  const open = (slug: string) => router.push({ pathname: "/salon/[slug]", params: { slug } });
  return (
    <Screen refreshing={loading} onRefresh={reload} contentStyle={top}>
      <Text style={styles.h1} accessibilityRole="header">
        {t.saved.title}
      </Text>
      {data.favourites.length === 0 ? (
        <Empty title={t.saved.empty} />
      ) : (
        <View style={{ gap: space(2) }}>
          {data.favourites.map((l) => (
            <Card key={l!.id} onPress={() => open(l!.slug)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={[styles.h3, { flex: 1 }]} numberOfLines={1}>
                {l!.name}
              </Text>
              <Button
                title={t.saved.book}
                small
                variant="outline"
                onPress={() => router.push({ pathname: "/book/[slug]", params: { slug: l!.slug } })}
              />
            </Card>
          ))}
        </View>
      )}
      {data.notes.length > 0 ? (
        <Section title={t.saved.notes}>
          {data.notes.map((n) => (
            <Card key={n.listing!.id} onPress={() => open(n.listing!.slug)}>
              <Text style={styles.h3}>{n.listing!.name}</Text>
              <Text style={styles.body}>{n.body}</Text>
            </Card>
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}
