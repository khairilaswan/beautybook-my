import { Suspense } from "react";
import { requirePermission } from "@/lib/auth";
import { getWebsiteSettings } from "@/lib/data/website-settings";
import { getCategories } from "@/lib/data/directory";
import { WebsiteForm } from "./website-form";
export const metadata = { title: "Website settings" };
export default function Page() {
  return (
    <>
      <h1 className="text-2xl font-bold">Website settings</h1>
      <p className="mt-2 text-muted">
        Manage branding, homepage images and search appearance.
      </p>
      <Suspense fallback={<p>Loading…</p>}>
        <Settings />
      </Suspense>
    </>
  );
}
async function Settings() {
  await requirePermission("staff.manage");
  const [settings, categories] = await Promise.all([
    getWebsiteSettings(),
    getCategories(),
  ]);
  return (
    <WebsiteForm
      settings={settings}
      categories={categories.map((c) => ({ slug: c.slug, name: c.name_en }))}
    />
  );
}
