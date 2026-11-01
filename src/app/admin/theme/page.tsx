import type { Metadata } from "next";
import { Suspense } from "react";
import { requirePermission } from "@/lib/auth";
import { getSiteTheme } from "@/lib/data/site-theme";
import { ThemePicker } from "./theme-picker";

export const metadata: Metadata = { title: "Theme" };

export default function Page() {
  return (
    <>
      <h1 className="text-2xl font-bold">Theme</h1>
      <p className="mt-1 text-muted">
        Choose how the whole site looks. Preview it first in your own browser, then use it for everyone.
      </p>
      <Suspense fallback={<p className="mt-6 text-muted">Loading…</p>}>
        <ThemeSettings />
      </Suspense>
    </>
  );
}

async function ThemeSettings() {
  await requirePermission("staff.manage");
  return <ThemePicker current={await getSiteTheme()} />;
}
