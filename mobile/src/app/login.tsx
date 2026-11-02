import * as AppleAuthentication from "expo-apple-authentication";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Field, Notice, Screen, styles } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { authRedirectUrl, codeFromUrl, exchangeCode } from "@/lib/auth-links";
import { fmt, useI18n } from "@/lib/i18n";
import { openWebPage, webPath } from "@/lib/links";
import { normalizeMalaysianPhone } from "@/lib/phone";
import { supabase } from "@/lib/supabase";
import { colors, space } from "@/lib/theme";

WebBrowser.maybeCompleteAuthSession();

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function Login() {
  const { t, locale } = useI18n();
  const { config, canBrowse } = useAuth();
  const insets = useSafeAreaInsets();
  const methods = config.loginMethods;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  // Phone codes (only while SMS is set up in Supabase).
  const [phone, setPhone] = useState("");
  const [phoneSentTo, setPhoneSentTo] = useState<string | null>(null);
  const [phoneCode, setPhoneCode] = useState("");

  // Email: a sign-in link (with an optional 6-digit code), or a password.
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [emailCode, setEmailCode] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (Platform.OS === "ios" && methods.apple) {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
    }
  }, [methods.apple]);

  async function withBusy(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  }

  const oauth = (provider: "google" | "facebook") =>
    withBusy(provider, async () => {
      const redirectTo = authRedirectUrl();
      const { data, error: startError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (startError || !data.url) {
        setError(t.login.errors.start);
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== "success") return; // closed by the user
      const code = codeFromUrl(result.url);
      if (!code || !(await exchangeCode(code))) setError(t.login.errors.expired);
    });

  const apple = () =>
    withBusy("apple", async () => {
      try {
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });
        if (!credential.identityToken) {
          setError(t.login.errors.start);
          return;
        }
        const { data, error: idError } = await supabase.auth.signInWithIdToken({
          provider: "apple",
          token: credential.identityToken,
        });
        if (idError || !data.user) {
          setError(t.login.errors.start);
          return;
        }
        // Apple shares the name only on the very first sign-in.
        const fullName = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(" ");
        if (fullName) {
          await supabase.auth.updateUser({ data: { full_name: fullName } });
          await supabase.from("profiles").update({ display_name: fullName }).eq("id", data.user.id).is("display_name", null);
        }
      } catch (e) {
        if ((e as { code?: string }).code !== "ERR_REQUEST_CANCELED") setError(t.login.errors.start);
      }
    });

  const sendPhone = () =>
    withBusy("phone", async () => {
      const normalized = normalizeMalaysianPhone(phone);
      if (!normalized) {
        setError(t.login.errors.mobile);
        return;
      }
      const { error: sendError } = await supabase.auth.signInWithOtp({ phone: `+${normalized}` });
      if (sendError) setError(t.login.errors.sendCode);
      else setPhoneSentTo(normalized);
    });

  const verifyPhone = () =>
    withBusy("phone", async () => {
      if (!phoneSentTo || !/^[0-9]{6}$/.test(phoneCode.trim())) {
        setError(t.login.errors.badCode);
        return;
      }
      const { error: verifyError } = await supabase.auth.verifyOtp({ phone: `+${phoneSentTo}`, token: phoneCode.trim(), type: "sms" });
      if (verifyError) setError(t.login.errors.badCode);
    });

  const sendEmail = () =>
    withBusy("email", async () => {
      const address = email.trim();
      if (!EMAIL.test(address)) {
        setError(t.login.errors.email);
        return;
      }
      const { error: sendError } = await supabase.auth.signInWithOtp({
        email: address,
        options: { emailRedirectTo: authRedirectUrl() },
      });
      if (sendError) setError(t.login.errors.sendEmail);
      else setEmailSent(true);
    });

  const verifyEmail = () =>
    withBusy("email", async () => {
      const token = emailCode.trim();
      if (!/^[0-9]{6,10}$/.test(token)) {
        setError(t.login.errors.badCode);
        return;
      }
      const { error: verifyError } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: "email" });
      if (verifyError) setError(t.login.errors.badCode);
    });

  const passwordSignIn = () =>
    withBusy("password", async () => {
      if (!EMAIL.test(email.trim()) || !password) {
        setError(t.login.errors.password);
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) setError(t.login.errors.password);
    });

  const social = methods.google || methods.facebook || appleAvailable;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen contentStyle={{ paddingTop: insets.top + space(8), gap: space(5) }}>
        {canBrowse && router.canGoBack() ? (
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ alignSelf: "flex-end" }}>
            <Text style={styles.link}>{t.common.close}</Text>
          </Pressable>
        ) : null}
        <View style={{ gap: space(2) }}>
          <Text style={[styles.h1, { color: colors.brand600 }]}>BeautyBook</Text>
          <Text style={styles.h2} accessibilityRole="header">
            {t.login.title}
          </Text>
          <Text style={styles.muted}>{config.membersOnly ? t.login.membersOnly : t.login.lead}</Text>
        </View>

        {error ? <Notice text={error} tone="error" /> : null}

        {social ? (
          <View style={{ gap: space(2) }}>
            {appleAvailable ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={12}
                style={{ height: 48 }}
                onPress={apple}
              />
            ) : null}
            {methods.google ? (
              <Button title={t.login.google} variant="outline" loading={busy === "google"} disabled={!!busy} onPress={() => oauth("google")} />
            ) : null}
            {methods.facebook ? (
              <Button
                title={t.login.facebook}
                variant="outline"
                loading={busy === "facebook"}
                disabled={!!busy}
                onPress={() => oauth("facebook")}
              />
            ) : null}
            <View style={[styles.row, { marginTop: space(2) }]}>
              <View style={[styles.divider, { flex: 1 }]} />
              <Text style={styles.muted}>{t.login.or}</Text>
              <View style={[styles.divider, { flex: 1 }]} />
            </View>
          </View>
        ) : null}

        {methods.phone ? (
          <View style={{ gap: space(2) }}>
            {phoneSentTo ? (
              <>
                <Field
                  label={fmt(t.login.codeSentTo, { phone: phoneSentTo })}
                  value={phoneCode}
                  onChangeText={setPhoneCode}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  maxLength={6}
                />
                <Button title={t.login.signIn} loading={busy === "phone"} disabled={!!busy} onPress={verifyPhone} />
              </>
            ) : (
              <>
                <Field
                  label={t.login.mobile}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  placeholder="012-345 6789"
                />
                <Button title={t.login.sendCode} loading={busy === "phone"} disabled={!!busy} onPress={sendPhone} />
              </>
            )}
          </View>
        ) : null}

        <View style={{ gap: space(2) }}>
          <Field
            label={t.login.email}
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setEmailSent(false);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            autoCorrect={false}
          />
          {usePassword ? (
            <>
              <Field
                label={t.login.password}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="current-password"
                textContentType="password"
              />
              <Button title={t.login.signIn} loading={busy === "password"} disabled={!!busy} onPress={passwordSignIn} />
            </>
          ) : emailSent ? (
            <>
              <Notice text={t.login.checkInbox} tone="green" />
              <Field
                label={t.login.emailCode}
                value={emailCode}
                onChangeText={setEmailCode}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={10}
              />
              <Button title={t.login.signIn} loading={busy === "email"} disabled={!!busy} onPress={verifyEmail} />
            </>
          ) : (
            <Button title={t.login.emailMe} variant="outline" loading={busy === "email"} disabled={!!busy} onPress={sendEmail} />
          )}
          <Pressable accessibilityRole="button" onPress={() => setUsePassword(!usePassword)} style={{ paddingVertical: space(2) }}>
            <Text style={[styles.link, { textAlign: "center" }]}>{usePassword ? t.login.useLink : t.login.usePassword}</Text>
          </Pressable>
        </View>

        <Pressable accessibilityRole="link" onPress={() => openWebPage(webPath(locale, "/privacy"))}>
          <Text style={[styles.small, { textAlign: "center", textDecorationLine: "underline" }]}>{t.login.privacy}</Text>
        </Pressable>
      </Screen>
    </KeyboardAvoidingView>
  );
}
