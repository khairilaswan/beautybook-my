import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Text, View } from "react-native";
import { styles } from "@/components/ui";
import { AuthProvider, useAuth } from "@/lib/auth";
import { envReady } from "@/lib/env";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { colors } from "@/lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  return (
    <I18nProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Root />
      </AuthProvider>
    </I18nProvider>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.center}>
      <Text style={[styles.h2, { textAlign: "center" }]}>{title}</Text>
      <Text style={[styles.muted, { textAlign: "center", marginTop: 8 }]}>{body}</Text>
    </View>
  );
}

function Root() {
  const { ready, session, canBrowse, updateRequired } = useAuth();
  const { t } = useI18n();

  useEffect(() => {
    if (ready || !envReady) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!envReady) return <Message title={t.setup.title} body={t.setup.body} />;
  // The splash screen stays up until the session and settings are loaded.
  if (!ready) return null;
  if (updateRequired) return <Message title={t.update.title} body={t.update.body} />;

  const signedIn = !!session;
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.ink,
        headerBackButtonDisplayMode: "minimal",
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.canvas },
        contentStyle: { backgroundColor: colors.canvas },
      }}
    >
      {/* While the site is members-only, everything below needs an approved
          account (the same rule as the website's proxy). */}
      <Stack.Protected guard={canBrowse}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "" }} />
        <Stack.Screen name="salon/[slug]" options={{ title: "" }} />
        <Stack.Screen name="book/[slug]" options={{ presentation: "modal", title: t.booking.title }} />
        <Stack.Screen name="quote/[slug]" options={{ presentation: "modal", title: t.quote.title }} />
        <Stack.Screen name="review/[id]" options={{ presentation: "modal", title: t.review.title }} />
        <Stack.Screen name="malls" options={{ title: t.home.malls }} />
        <Stack.Screen name="owner/index" options={{ title: t.owner.title }} />
        <Stack.Screen name="owner/[id]/index" options={{ title: "" }} />
        <Stack.Screen name="owner/[id]/details" options={{ title: "Shop profile" }} />
        <Stack.Screen name="owner/[id]/menu" options={{ title: "Menu and prices" }} />
        <Stack.Screen name="owner/[id]/hours" options={{ title: "Opening hours" }} />
        <Stack.Screen name="owner/[id]/photos" options={{ title: "Photos" }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" options={{ headerShown: false, presentation: canBrowse ? "modal" : "card" }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !canBrowse}>
        <Stack.Screen name="pending" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
    </Stack>
  );
}
