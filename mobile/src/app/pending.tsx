import { useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Screen, styles } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { confirmDeleteAccount } from "@/lib/delete-account";
import { fmt, useI18n } from "@/lib/i18n";
import { space } from "@/lib/theme";

// Signed-in accounts that aren't approved yet (members-only mode).
export default function Pending() {
  const { t, locale } = useI18n();
  const { access, session, refresh, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [checking, setChecking] = useState(false);
  const rejected = access === "rejected";
  const who = session?.user.email ?? (session?.user.phone ? `+${session.user.phone}` : "");

  return (
    <Screen contentStyle={{ paddingTop: insets.top + space(12) }}>
      <View style={{ gap: space(3) }}>
        <Text style={styles.h1} accessibilityRole="header">
          {rejected ? t.pending.rejectedTitle : t.pending.title}
        </Text>
        <Text style={styles.body}>{rejected ? t.pending.rejectedBody : t.pending.body}</Text>
        {who ? <Text style={styles.muted}>{fmt(t.pending.signedInAs, { who })}</Text> : null}
      </View>
      <View style={{ gap: space(2) }}>
        {!rejected ? (
          <Button
            title={t.pending.checkAgain}
            loading={checking}
            onPress={async () => {
              setChecking(true);
              await refresh();
              setChecking(false);
            }}
          />
        ) : null}
        <Button title={t.common.signOut} variant="outline" onPress={signOut} />
        <Button title={t.account.deleteAccount} variant="danger" onPress={() => confirmDeleteAccount(t, locale, signOut)} />
      </View>
    </Screen>
  );
}
