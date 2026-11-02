import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Button, Empty, ErrorView, Loading, Notice, Screen, styles } from "@/components/ui";
import { refreshWebsite } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { type OwnerListing, loadOwnerListing } from "@/lib/owner";
import { photoUrl, supabase } from "@/lib/supabase";
import { colors, radius } from "@/lib/theme";
import { uploadListingPhoto } from "@/lib/upload";
import { useAsync } from "@/lib/use-async";

type Photo = { id: number; storage_path: string; status: string; sort_order: number };

export default function OwnerPhotos() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();
  const { data, loading, reload } = useAsync(async () => {
    const listing = await loadOwnerListing(id, userId);
    if (!listing) return null;
    const { data: photos, error } = await supabase
      .from("photos")
      .select("id, storage_path, status, sort_order")
      .eq("listing_id", id)
      .eq("kind", "shop")
      .order("sort_order")
      .order("id");
    if (error) throw error;
    return { listing, photos: (photos ?? []) as Photo[] };
  }, [id, userId]);

  if (data === undefined) return loading ? <Loading /> : <ErrorView onRetry={reload} />;
  if (data === null) return <Empty title="You don't manage this business." />;
  return <PhotoManager listing={data.listing} photos={data.photos} reload={reload} refreshing={loading} />;
}

function PhotoManager({
  listing,
  photos,
  reload,
  refreshing,
}: {
  listing: OwnerListing;
  photos: Photo[];
  reload: () => Promise<void>;
  refreshing: boolean;
}) {
  const { locale } = useI18n();
  const { userId } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  async function addPhotos() {
    setStatus(null);
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 1,
    });
    if (picked.canceled || picked.assets.length === 0) return;
    const assets = picked.assets.slice(0, 10);
    let added = 0;
    for (const [i, asset] of assets.entries()) {
      setBusy(`Uploading ${i + 1} of ${assets.length}…`);
      const uploaded = await uploadListingPhoto(listing.id, asset);
      if ("error" in uploaded) {
        setStatus({ ok: false, text: uploaded.error });
        break;
      }
      const { error } = await supabase.from("photos").insert({
        listing_id: listing.id,
        storage_path: uploaded.path,
        source: "owner",
        uploaded_by: userId,
        sort_order: Date.now() % 1_000_000,
      });
      if (error) {
        await supabase.storage.from("listing-photos").remove([uploaded.path]);
        setStatus({ ok: false, text: "Could not add the photo." });
        break;
      }
      added++;
    }
    setBusy(null);
    if (added > 0) {
      refreshWebsite(listing.id, "listing", locale);
      if (added === assets.length) setStatus({ ok: true, text: added === 1 ? "Photo added." : `${added} photos added.` });
      await reload();
    }
  }

  function removePhoto(photo: Photo) {
    Alert.alert("Remove this photo?", "It will disappear from your shop page.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setBusy("Removing…");
          const { data } = await supabase
            .from("photos")
            .delete()
            .eq("id", photo.id)
            .eq("listing_id", listing.id)
            .select("storage_path");
          if (data?.[0]) await supabase.storage.from("listing-photos").remove([data[0].storage_path as string]);
          setBusy(null);
          if (!data?.length) setStatus({ ok: false, text: "Could not remove the photo." });
          else refreshWebsite(listing.id, "listing", locale);
          await reload();
        },
      },
    ]);
  }

  async function makeProfile(photo: Photo) {
    setBusy("Saving…");
    const first = photos[0]?.sort_order ?? 0;
    const { data, error } = await supabase
      .from("photos")
      .update({ sort_order: first - 1 })
      .eq("id", photo.id)
      .eq("listing_id", listing.id)
      .eq("kind", "shop")
      .select("id");
    setBusy(null);
    if (error || !data?.length) setStatus({ ok: false, text: "Could not set the profile photo." });
    else {
      refreshWebsite(listing.id, "listing", locale);
      setStatus({ ok: true, text: "Profile photo set." });
    }
    await reload();
  }

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <Text style={styles.h2}>{listing.name}</Text>
      {photos.length === 0 ? <Text style={styles.muted}>No photos yet. Shops with photos get far more taps.</Text> : null}
      <View style={styles.wrap}>
        {photos.map((p, i) => (
          <View
            key={p.id}
            style={{ width: "31%", aspectRatio: 1, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.brand50 }}
          >
            <Image source={photoUrl(p.storage_path)} style={{ flex: 1 }} contentFit="cover" accessibilityLabel={`Photo ${i + 1}`} />
            <Pressable
              onPress={() => removePhoto(p)}
              disabled={!!busy}
              accessibilityRole="button"
              accessibilityLabel="Remove photo"
              hitSlop={6}
              style={{ position: "absolute", top: 4, right: 4, backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 12, paddingHorizontal: 7, paddingVertical: 2 }}
            >
              <Text style={{ fontSize: 13, color: colors.ink }}>✕</Text>
            </Pressable>
            {i === 0 ? (
              <Text
                style={{ position: "absolute", left: 4, right: 4, bottom: 4, backgroundColor: colors.ink, color: colors.white, borderRadius: 10, fontSize: 11, textAlign: "center", paddingVertical: 2, overflow: "hidden" }}
              >
                Profile photo
              </Text>
            ) : (
              <Pressable
                onPress={() => makeProfile(p)}
                disabled={!!busy}
                accessibilityRole="button"
                accessibilityLabel="Make profile photo"
                style={{ position: "absolute", left: 4, right: 4, bottom: 4, backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 10, paddingVertical: 2 }}
              >
                <Text style={{ fontSize: 11, textAlign: "center", color: colors.ink }}>Make profile</Text>
              </Pressable>
            )}
            {p.status !== "approved" ? (
              <Text style={{ position: "absolute", top: 4, left: 4, backgroundColor: colors.white, fontSize: 10, paddingHorizontal: 4, borderRadius: 4, overflow: "hidden" }}>
                {p.status}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
      {photos.length > 0 ? (
        <Text style={styles.small}>Your profile photo shows first on your shop page and on search results.</Text>
      ) : null}
      {status ? <Notice text={status.text} tone={status.ok ? "green" : "error"} /> : null}
      <Button title={busy ?? "Add photos"} loading={!!busy} onPress={addPhotos} />
      <Text style={styles.small}>Only upload photos you took or have permission to use. Up to 10 at a time.</Text>
    </Screen>
  );
}
