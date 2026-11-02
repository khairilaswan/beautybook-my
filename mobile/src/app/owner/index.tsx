import { Redirect, router } from "expo-router";
import { Text } from "react-native";
import { Button, Card, Empty, ErrorView, Loading, Screen, styles } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { openWebPage, webPath } from "@/lib/links";
import { supabase } from "@/lib/supabase";
import { space } from "@/lib/theme";
import { useAsync } from "@/lib/use-async";

type Row = { id: string; slug: string; name: string; status: string };

// The businesses this account manages. With just one, go straight to it.
export default function OwnerHome() {
  const { t, locale } = useI18n();
  const { userId } = useAuth();
  const { data, loading, reload } = useAsync(async () => {
    if (!userId) return [];
    const { data: rows, error } = await supabase
      .from("listing_members")
      .select("listing_id, listings ( id, slug, name, status )")
      .eq("user_id", userId);
    if (error) throw error;
    return (rows ?? []).map((m) => (m as unknown as { listings: Row | null }).listings).filter((l): l is Row => !!l);
  }, [userId]);

  if (!data && loading) return <Loading />;
  if (!data) return <ErrorView onRetry={reload} />;
  if (data.length === 1) return <Redirect href={{ pathname: "/owner/[id]", params: { id: data[0].id } }} />;
  if (data.length === 0) {
    return (
      <Empty title={t.owner.none} body={t.owner.noneBody}>
        <Button
          title={t.owner.claim}
          style={{ marginTop: space(4) }}
          onPress={() => openWebPage(webPath(locale, "/for-business"))}
        />
      </Empty>
    );
  }
  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Text style={styles.h2}>Your businesses</Text>
      {data.map((l) => (
        <Card key={l.id} onPress={() => router.push({ pathname: "/owner/[id]", params: { id: l.id } })}>
          <Text style={styles.h3}>{l.name}</Text>
          <Text style={[styles.muted, { textTransform: "capitalize" }]}>{l.status}</Text>
        </Card>
      ))}
    </Screen>
  );
}
