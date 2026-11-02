import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import Constants from "expo-constants";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { type AppConfig, FALLBACK_CONFIG, fetchConfig } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

export type Access = "approved" | "pending" | "rejected";

type AuthValue = {
  // False until the stored session and the site settings have loaded.
  ready: boolean;
  session: Session | null;
  userId: string | null;
  // The account's members-only status (null when signed out).
  access: Access | null;
  config: AppConfig;
  // True when the directory may be shown: the site is open to everyone, or
  // this account is an approved member.
  canBrowse: boolean;
  updateRequired: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);
const CONFIG_KEY = "bb.config";

// "1.10.0" > "1.9.2"
export function versionLessThan(a: string, b: string): boolean {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}

async function loadAccess(userId: string): Promise<Access> {
  const { data } = await supabase.from("member_access").select("status").eq("user_id", userId).maybeSingle();
  const status = data?.status;
  return status === "approved" || status === "rejected" ? status : "pending";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  const [accessFor, setAccessFor] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    const fresh = await fetchConfig(locale);
    if (fresh) {
      setConfig(fresh);
      AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(fresh)).catch(() => {});
      return;
    }
    // Offline: the last settings we saw, or the safe defaults.
    const cached = await AsyncStorage.getItem(CONFIG_KEY).catch(() => null);
    setConfig((current) => current ?? (cached ? { ...FALLBACK_CONFIG, ...(JSON.parse(cached) as AppConfig) } : FALLBACK_CONFIG));
  }, [locale]);

  useEffect(() => {
    // Fetching the settings on start-up is this effect's job.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadConfig();
    // Only on start-up; refresh() reloads it on demand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .finally(() => setSessionLoaded(true));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    // Signed out: nothing to load (access only counts for accessFor's user).
    if (!userId) return;
    let cancelled = false;
    loadAccess(userId)
      .then((a) => {
        if (!cancelled) {
          setAccess(a);
          setAccessFor(userId);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAccess("pending");
          setAccessFor(userId);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const refresh = useCallback(async () => {
    await loadConfig();
    if (userId) {
      setAccess(await loadAccess(userId).catch(() => "pending" as const));
      setAccessFor(userId);
    }
  }, [loadConfig, userId]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut().catch(() => {});
    setSession(null);
  }, []);

  const value = useMemo<AuthValue>(() => {
    const cfg = config ?? FALLBACK_CONFIG;
    const accessReady = !userId || accessFor === userId;
    const version = Constants.expoConfig?.version ?? "0.0.0";
    return {
      ready: sessionLoaded && config !== null && accessReady,
      session,
      userId,
      access: userId && accessFor === userId ? access : null,
      config: cfg,
      canBrowse: !cfg.membersOnly || (!!userId && accessFor === userId && access === "approved"),
      updateRequired: !!cfg.minAppVersion && versionLessThan(version, cfg.minAppVersion),
      refresh,
      signOut,
    };
  }, [config, session, sessionLoaded, userId, access, accessFor, refresh, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth outside AuthProvider");
  return value;
}
