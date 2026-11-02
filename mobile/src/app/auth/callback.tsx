import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ErrorView, Loading } from "@/components/ui";
import { exchangeCode } from "@/lib/auth-links";
import { useI18n } from "@/lib/i18n";

// Email sign-in links (and, on Android, Google) come back to
// beautybook://auth/callback?code=…; this turns the code into a session.
export default function AuthCallback() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { t } = useI18n();
  const [exchangeFailed, setExchangeFailed] = useState(false);

  useEffect(() => {
    if (!code) return;
    exchangeCode(code).then((ok) => {
      if (ok) router.replace("/");
      else setExchangeFailed(true);
    });
  }, [code]);

  if (!code || exchangeFailed) return <ErrorView message={t.login.errors.expired} onRetry={() => router.replace("/")} />;
  return <Loading />;
}
