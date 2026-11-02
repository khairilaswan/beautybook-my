import { Alert } from "react-native";
import { deleteAccount } from "@/lib/api";
import type { Dictionary } from "@/lib/i18n/en";
import type { Locale } from "@/lib/i18n/config";

// Asks first, then deletes the account on the server and signs out.
export function confirmDeleteAccount(t: Dictionary, locale: Locale, signOut: () => Promise<void>): void {
  Alert.alert(t.account.deleteTitle, t.account.deleteBody, [
    { text: t.common.cancel, style: "cancel" },
    {
      text: t.account.deleteConfirm,
      style: "destructive",
      onPress: async () => {
        const res = await deleteAccount(locale);
        if (!res.ok) {
          Alert.alert("", res.error ?? t.common.error);
          return;
        }
        await signOut();
        Alert.alert("", t.account.deleted);
      },
    },
  ]);
}
