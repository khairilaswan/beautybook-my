import { Image } from "expo-image";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useState } from "react";
import { Alert, Dimensions, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Card, Chip, Empty, ErrorView, Loading, Notice, Pill, Section, Stars, styles } from "@/components/ui";
import { track } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getListing, getReviews, getTaxonomy } from "@/lib/data";
import { formatDate, priceLabel, priceLevelLabel, priceRangeLabel } from "@/lib/format";
import { isOpenAt, weeklySchedule } from "@/lib/hours";
import { fmt, useI18n } from "@/lib/i18n";
import { areaName, attributeName, categoryName, serviceName } from "@/lib/i18n/names";
import { mapsUrl, openExternal, openWebPage, webPath } from "@/lib/links";
import { formatMalaysianPhone } from "@/lib/phone";
import { photoUrl, supabase, videoUrl } from "@/lib/supabase";
import { colors, radius, space } from "@/lib/theme";
import type { ListingDetail, Photo } from "@/lib/types";
import { useAsync } from "@/lib/use-async";

const WIDTH = Dimensions.get("window").width;

export default function Shop() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t, locale } = useI18n();
  const { config } = useAuth();
  const insets = useSafeAreaInsets();

  const { data, error, loading, reload } = useAsync(async () => {
    const [listing, taxonomy] = await Promise.all([getListing(slug), getTaxonomy()]);
    const reviews = listing && config.reviewsEnabled ? await getReviews(listing.id) : null;
    return { listing, reviews, categories: taxonomy.categories };
  }, [slug, config.reviewsEnabled]);

  const listingId = data?.listing?.id;
  useEffect(() => {
    if (listingId) track(listingId, "view", locale);
  }, [listingId, locale]);

  if (!data && loading) return <Loading />;
  if (!data) return <ErrorView onRetry={reload} />;
  if (!data.listing) {
    return (
      <>
        <Stack.Screen options={{ title: "" }} />
        <Empty title={t.shop.notFound} />
      </>
    );
  }

  const listing = data.listing;
  const waNumber = listing.whatsapp ?? (listing.phone?.startsWith("601") ? listing.phone : null);
  const bookable = listing.status === "active" && !!waNumber;
  const instant = listing.is_claimed && !!listing.booking?.instant_enabled;
  const shopPhotos = listing.photos.filter((p) => p.kind === "shop");
  const teamPhotos = listing.photos.filter((p) => p.kind === "team");
  const portfolio = listing.photos.filter((p) => p.kind === "portfolio");
  const open = isOpenAt(listing.hours, listing.closures);
  const book = (params: Record<string, string> = {}) =>
    router.push({ pathname: "/book/[slug]", params: { slug: listing.slug, ...params } });
  const shopUrl = `${config.siteUrl}${webPath(locale, `/salon/${listing.slug}`)}`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen
        options={{
          title: listing.name,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => Share.share({ message: fmt(t.shop.shareText, { name: listing.name, url: shopUrl }) }).catch(() => {})}
            >
              <Text style={styles.link}>{t.shop.share}</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: bookable ? 110 + insets.bottom : space(16) }}>
        {shopPhotos.length > 0 ? <Gallery photos={shopPhotos} name={listing.name} /> : null}

        <View style={{ padding: space(4), gap: space(6) }}>
          {error ? <Notice text={t.common.offline} tone="error" /> : null}
          {listing.status === "closed" ? <Notice text={t.shop.closedPermanently} /> : null}

          <View style={{ gap: space(2) }}>
            <Text style={styles.h1} accessibilityRole="header">
              {listing.name}
            </Text>
            <Text style={styles.muted}>
              {[listing.categories.map((c) => categoryName(c, locale)).join(", "), listing.area && areaName(listing.area, locale)]
                .filter(Boolean)
                .join(" · ")}
            </Text>
            {listing.mall ? (
              <Pressable onPress={() => router.navigate({ pathname: "/explore", params: { mall: listing.mall!.slug } })}>
                <Text style={styles.link}>{fmt(t.shop.inside, { mall: listing.mall.name })}</Text>
              </Pressable>
            ) : null}
            <View style={[styles.wrap, { gap: space(1.5) }]}>
              {listing.hours.length > 0 ? <Pill label={open ? t.common.openNow : t.common.closedNow} tone={open ? "green" : "plain"} /> : null}
              {listing.gender ? <Pill label={t.common.gender[listing.gender]} /> : null}
              {listing.price_level ? <Pill label={priceLevelLabel(listing.price_level)!} /> : null}
              {listing.is_claimed ? <Pill label={t.shop.managedByOwner} tone="brand" /> : null}
              {data.reviews && data.reviews.count > 0 ? <Pill label={`★ ${data.reviews.average} (${data.reviews.count})`} /> : null}
              {instant ? <Pill label={t.shop.instant} tone="green" /> : null}
            </View>
          </View>

          <UserTools listing={listing} />

          <View style={[styles.wrap]}>
            {listing.phone && listing.status === "active" ? (
              <Button
                small
                variant="outline"
                title={`📞 ${t.shop.call}`}
                accessibilityLabel={`${t.shop.call} ${formatMalaysianPhone(listing.phone)}`}
                onPress={() => {
                  track(listing.id, "call", locale);
                  void openExternal(`tel:+${listing.phone}`);
                }}
              />
            ) : null}
            <Button
              small
              variant="outline"
              title={`🧭 ${t.shop.directions}`}
              onPress={() => {
                track(listing.id, "directions", locale);
                void openExternal(mapsUrl(listing.lat, listing.lng, listing.name, listing.address));
              }}
            />
          </View>

          {listing.description ? (
            <Section title={t.shop.about}>
              <Text style={styles.body}>{listing.description}</Text>
            </Section>
          ) : null}

          {listing.promotions.length > 0 ? (
            <Section title={t.shop.deals}>
              {listing.promotions.map((p) => (
                <Card key={p.id} style={{ borderColor: colors.brand200 }}>
                  <Text style={styles.h3}>{p.title}</Text>
                  {p.details ? <Text style={styles.body}>{p.details}</Text> : null}
                  <Text style={styles.muted}>
                    {[p.price_label, fmt(t.home.until, { date: formatDate(p.ends_on, locale) })].filter(Boolean).join(" · ")}
                  </Text>
                  {bookable ? (
                    <Button title={t.shop.bookDeal} small style={{ alignSelf: "flex-start", marginTop: space(2) }} onPress={() => book({ deal: String(p.id) })} />
                  ) : null}
                </Card>
              ))}
            </Section>
          ) : null}

          <Section title={t.shop.services}>
            {listing.services.length === 0 ? (
              <Text style={styles.muted}>{t.shop.askMenu}</Text>
            ) : (
              <View style={st.list}>
                {listing.services.map((s, i) => (
                  <Pressable
                    key={s.id}
                    disabled={!bookable}
                    onPress={() => book({ service: String(s.id) })}
                    style={[st.listRow, i > 0 && st.listDivider]}
                  >
                    <Text style={[styles.body, { flex: 1 }]}>
                      {serviceName(s, locale)}
                      {s.duration_min ? <Text style={styles.muted}>{`  ${fmt(t.common.minutes, { count: s.duration_min })}`}</Text> : null}
                    </Text>
                    <Text style={[styles.body, { fontWeight: "600" }]}>{priceLabel(s, locale) ?? t.common.askForPrice}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            {listing.services_are_template ? <Text style={styles.small}>{t.shop.templateNote}</Text> : null}
          </Section>

          {listing.packages.length > 0 ? (
            <Section title={t.shop.packages}>
              {listing.packages.map((p) => (
                <Card key={p.id}>
                  <Text style={styles.h3}>{p.name}</Text>
                  {p.description ? <Text style={styles.body}>{p.description}</Text> : null}
                  {p.includes.length > 0 ? <Text style={styles.muted}>{p.includes.map((x) => `• ${x}`).join("\n")}</Text> : null}
                  {priceRangeLabel(p.price_from, p.price_to, locale) ? (
                    <Text style={[styles.body, { fontWeight: "600" }]}>{priceRangeLabel(p.price_from, p.price_to, locale)}</Text>
                  ) : null}
                  {bookable ? (
                    <Button
                      title={t.shop.requestQuote}
                      small
                      variant="outline"
                      style={{ alignSelf: "flex-start", marginTop: space(2) }}
                      onPress={() => router.push({ pathname: "/quote/[slug]", params: { slug: listing.slug, package: String(p.id) } })}
                    />
                  ) : null}
                </Card>
              ))}
              {bookable ? (
                <Button title={t.shop.customQuote} variant="ghost" onPress={() => router.push({ pathname: "/quote/[slug]", params: { slug: listing.slug } })} />
              ) : null}
            </Section>
          ) : null}

          {listing.video_path ? (
            <Section title={t.shop.video}>
              <ShopVideo path={listing.video_path} />
            </Section>
          ) : null}

          {portfolio.length > 0 ? (
            <Section title={t.shop.ourWork}>
              <Portfolio photos={portfolio} categories={data.categories} />
            </Section>
          ) : null}

          {listing.staff.length > 0 || teamPhotos.length > 0 ? (
            <Section title={t.shop.ourTeam}>
              {teamPhotos.map((p) => (
                <Image key={p.id} source={photoUrl(p.storage_path)} style={st.teamPhoto} contentFit="cover" accessibilityLabel={p.alt ?? listing.name} />
              ))}
              {listing.staff.map((m) => (
                <Card key={m.id} style={{ flexDirection: "row", gap: space(3), alignItems: "center" }}>
                  <View style={st.avatar}>
                    {m.photo_path ? (
                      <Image source={photoUrl(m.photo_path)} style={StyleSheet.absoluteFill} contentFit="cover" />
                    ) : (
                      <Text style={{ color: colors.brand600, fontWeight: "700" }}>{m.name.slice(0, 1)}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.h3}>{m.name}</Text>
                    {m.title ? <Text style={styles.muted}>{m.title}</Text> : null}
                    {m.languages.length > 0 ? <Text style={styles.small}>{fmt(t.shop.speaks, { languages: m.languages.join(", ") })}</Text> : null}
                    {m.bio ? <Text style={styles.body}>{m.bio}</Text> : null}
                    {bookable ? (
                      <Pressable onPress={() => book({ staff: String(m.id) })}>
                        <Text style={styles.link}>{fmt(t.shop.bookWith, { name: m.name })}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </Card>
              ))}
            </Section>
          ) : null}

          {data.reviews ? (
            <Section title={t.shop.reviews}>
              {data.reviews.count === 0 ? (
                <Text style={styles.muted}>{t.shop.noReviews}</Text>
              ) : (
                <>
                  <View style={styles.row}>
                    <Text style={styles.h2}>{data.reviews.average}</Text>
                    <Stars value={data.reviews.average ?? 0} size={18} />
                    <Text style={styles.muted}>
                      {data.reviews.count === 1 ? t.shop.fromOne : fmt(t.shop.fromMany, { count: data.reviews.count })}
                    </Text>
                  </View>
                  {data.reviews.reviews.slice(0, 20).map((r) => (
                    <Card key={r.id}>
                      <View style={[styles.row, { justifyContent: "space-between" }]}>
                        <Text style={styles.h3}>{r.author_name}</Text>
                        <Stars value={r.rating} />
                      </View>
                      <Text style={styles.small}>
                        {[t.shop.verified, r.service_name, formatDate(r.created_at, locale)].filter(Boolean).join(" · ")}
                      </Text>
                      {r.body ? <Text style={styles.body}>{r.body}</Text> : null}
                      {r.owner_reply ? (
                        <View style={{ backgroundColor: colors.canvas, borderRadius: radius.md, padding: space(3), marginTop: space(1) }}>
                          <Text style={styles.small}>{t.shop.reply}</Text>
                          <Text style={styles.body}>{r.owner_reply}</Text>
                        </View>
                      ) : null}
                    </Card>
                  ))}
                </>
              )}
            </Section>
          ) : null}

          {listing.service_areas.length > 0 ? (
            <Section title={t.shop.comesToYou}>
              <Text style={styles.body}>
                {fmt(t.shop.visitsIn, { areas: listing.service_areas.map((a) => areaName(a, locale)).join(", ") })}
              </Text>
            </Section>
          ) : null}

          {listing.attributes.length > 0 ? (
            <Section title={t.shop.goodToKnow}>
              <View style={styles.wrap}>
                {listing.attributes.map((a) => (
                  <Chip key={a.slug} label={attributeName(a, locale)} />
                ))}
              </View>
            </Section>
          ) : null}

          <Section title={t.shop.openingHours}>
            {listing.hours.length === 0 ? (
              <Text style={styles.muted}>{t.shop.noHours}</Text>
            ) : (
              <View style={st.list}>
                {weeklySchedule(listing.hours, locale).map((d, i) => (
                  <View key={d.weekday} style={[st.listRow, i > 0 && st.listDivider]}>
                    <Text style={[styles.body, { fontWeight: "500" }]}>{d.label}</Text>
                    <Text style={styles.body}>{d.slots.length ? d.slots.join(", ") : t.common.closed}</Text>
                  </View>
                ))}
              </View>
            )}
            {listing.closures.map((c) => (
              <Text key={c.date_from} style={styles.muted}>
                {fmt(t.shop.closedOn, { from: formatDate(c.date_from, locale) })}
                {c.date_to !== c.date_from ? fmt(t.shop.closedTo, { to: formatDate(c.date_to, locale) }) : ""}
                {c.note ? ` (${c.note})` : ""}
              </Text>
            ))}
          </Section>

          <Section title={t.shop.location}>
            {listing.address ? <Text style={styles.body}>{[listing.address, listing.postcode].filter(Boolean).join(" ")}</Text> : null}
            <Button
              title={t.shop.directions}
              variant="outline"
              onPress={() => {
                track(listing.id, "directions", locale);
                void openExternal(mapsUrl(listing.lat, listing.lng, listing.name, listing.address));
              }}
            />
          </Section>

          {listing.loyalty ? (
            <Card style={{ borderStyle: "dashed", borderColor: colors.brand200 }}>
              <Text style={styles.h3}>{t.shop.stampCard}</Text>
              <Text style={styles.muted}>
                {fmt(t.shop.stampCardBody, { count: listing.loyalty.stamps_required, reward: listing.loyalty.reward })}
              </Text>
            </Card>
          ) : null}

          {listing.vouchers && config.paymentsEnabled && listing.status === "active" ? (
            <Button
              title={`🎁 ${t.shop.giftVoucher}`}
              variant="outline"
              onPress={() => openWebPage(webPath(locale, `/salon/${listing.slug}/gift`))}
            />
          ) : null}

          {listing.instagram || listing.facebook || listing.website ? (
            <View style={styles.wrap}>
              {listing.instagram ? <Chip label="Instagram" onPress={() => openExternal(listing.instagram!)} /> : null}
              {listing.facebook ? <Chip label="Facebook" onPress={() => openExternal(listing.facebook!)} /> : null}
              {listing.website ? (
                <Chip
                  label={t.shop.website}
                  onPress={() => {
                    track(listing.id, "website", locale);
                    void openExternal(listing.website!);
                  }}
                />
              ) : null}
            </View>
          ) : null}

          {!listing.is_claimed && listing.status === "active" ? (
            <View style={{ backgroundColor: colors.ink, borderRadius: radius.lg, padding: space(5), gap: space(2) }}>
              <Text style={[styles.h3, { color: colors.white }]}>{t.shop.yourBusiness}</Text>
              <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 14, lineHeight: 20 }}>{t.shop.claimPitch}</Text>
              <Button
                title={t.shop.claimCta}
                variant="outline"
                small
                style={{ alignSelf: "flex-start", marginTop: space(2) }}
                onPress={() => openWebPage(webPath(locale, `/claim/${listing.slug}`))}
              />
            </View>
          ) : null}

          <Text style={styles.small}>
            {listing.last_verified_at ? `${fmt(t.shop.lastChecked, { date: formatDate(listing.last_verified_at, locale) })} ` : ""}
            <Text style={{ textDecorationLine: "underline" }} onPress={() => openWebPage(webPath(locale, `/salon/${listing.slug}/report`))}>
              {t.shop.report}
            </Text>
          </Text>
        </View>
      </ScrollView>

      {bookable ? (
        <View style={[st.bookBar, { paddingBottom: insets.bottom + space(3) }]}>
          <Button title={instant ? t.shop.bookTime : t.shop.bookWhatsApp} variant="whatsapp" onPress={() => book()} />
        </View>
      ) : null}
    </View>
  );
}

function Gallery({ photos, name }: { photos: Photo[]; name: string }) {
  const [index, setIndex] = useState(0);
  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / WIDTH))}
      >
        {photos.map((p, i) => (
          <Image
            key={p.id}
            source={photoUrl(p.storage_path)}
            style={{ width: WIDTH, height: WIDTH * 0.7, backgroundColor: colors.brand50 }}
            contentFit="cover"
            accessibilityLabel={p.alt ?? `${name} ${i + 1}`}
          />
        ))}
      </ScrollView>
      {photos.length > 1 ? (
        <View style={st.dots}>
          {photos.map((p, i) => (
            <View key={p.id} style={[st.dot, i === index && { backgroundColor: colors.white }]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Portfolio({ photos, categories }: { photos: Photo[]; categories: { id: number; name_en: string; name_ms: string; name_zh: string | null }[] }) {
  const { t, locale } = useI18n();
  const [filter, setFilter] = useState<number | null>(null);
  const used = categories.filter((c) => photos.some((p) => p.category_id === c.id));
  const shown = filter === null ? photos : photos.filter((p) => p.category_id === filter);
  const size = (WIDTH - space(4) * 2 - space(2) * 2) / 3;
  return (
    <>
      {used.length > 1 ? (
        <View style={styles.wrap}>
          <Chip label={t.shop.all} selected={filter === null} onPress={() => setFilter(null)} />
          {used.map((c) => (
            <Chip key={c.id} label={categoryName(c, locale)} selected={filter === c.id} onPress={() => setFilter(c.id)} />
          ))}
        </View>
      ) : null}
      <View style={[styles.wrap, { gap: space(2) }]}>
        {shown.map((p) => (
          <View key={p.id} style={{ width: size, gap: 2 }}>
            <Image source={photoUrl(p.storage_path)} style={{ width: size, height: size, borderRadius: radius.md, backgroundColor: colors.brand50 }} contentFit="cover" />
            {p.caption ? (
              <Text style={styles.small} numberOfLines={2}>
                {p.caption}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </>
  );
}

function ShopVideo({ path }: { path: string }) {
  const player = useVideoPlayer(videoUrl(path));
  return <VideoView player={player} nativeControls contentFit="contain" style={st.video} />;
}

// Save to favourites and keep a private note, as on the website.
function UserTools({ listing }: { listing: ListingDetail }) {
  const { t } = useI18n();
  const { userId } = useAuth();
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    Promise.all([
      supabase.from("favourites").select("listing_id").eq("listing_id", listing.id).maybeSingle(),
      supabase.from("notes").select("body").eq("listing_id", listing.id).maybeSingle(),
    ]).then(([fav, n]) => {
      if (cancelled) return;
      setSaved(!!fav.data);
      setNote((n.data?.body as string | undefined) ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [userId, listing.id]);

  const requireSignIn = () => {
    router.push("/login");
  };

  async function toggleSave() {
    if (!userId) return requireSignIn();
    const next = !saved;
    setSaved(next);
    const { error } = next
      ? await supabase.from("favourites").upsert({ user_id: userId, listing_id: listing.id })
      : await supabase.from("favourites").delete().eq("user_id", userId).eq("listing_id", listing.id);
    if (error) {
      setSaved(!next);
      Alert.alert("", t.common.error);
    }
  }

  async function saveNote() {
    if (!userId) return requireSignIn();
    const text = note.trim().slice(0, 2000);
    const { error } = text
      ? await supabase.from("notes").upsert({ user_id: userId, listing_id: listing.id, body: text, updated_at: new Date().toISOString() })
      : await supabase.from("notes").delete().eq("user_id", userId).eq("listing_id", listing.id);
    if (error) Alert.alert("", t.common.error);
    else setNoteSaved(true);
  }

  return (
    <View style={{ gap: space(2) }}>
      <View style={styles.wrap}>
        <Button small variant="outline" title={saved ? t.shop.saved : t.shop.save} onPress={toggleSave} />
        <Button
          small
          variant="outline"
          title={note ? t.shop.myNote : t.shop.addNote}
          onPress={() => (userId ? setEditing(!editing) : requireSignIn())}
        />
      </View>
      {editing ? (
        <Card>
          <Text style={styles.label}>{t.shop.noteLabel}</Text>
          <TextInput
            value={note}
            onChangeText={(v) => {
              setNote(v);
              setNoteSaved(false);
            }}
            multiline
            maxLength={2000}
            placeholder={t.shop.notePlaceholder}
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.inputMultiline, { marginTop: space(1) }]}
            accessibilityLabel={t.shop.noteLabel}
          />
          <View style={[styles.row, { justifyContent: "space-between", marginTop: space(2) }]}>
            <Text style={styles.small}>{noteSaved ? t.common.saved : ""}</Text>
            <Button small title={t.shop.saveNote} onPress={saveNote} />
          </View>
        </Card>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  list: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line },
  listRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: space(3), padding: space(4) },
  listDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  teamPhoto: { width: "100%", aspectRatio: 4 / 3, borderRadius: radius.lg, backgroundColor: colors.brand50 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: colors.brand50,
    alignItems: "center",
    justifyContent: "center",
  },
  video: { width: "100%", aspectRatio: 16 / 9, borderRadius: radius.lg, backgroundColor: "#000" },
  dots: { position: "absolute", bottom: space(3), alignSelf: "center", flexDirection: "row", gap: space(1.5) },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.5)" },
  bookBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space(4),
    paddingTop: space(3),
    backgroundColor: colors.canvas,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
