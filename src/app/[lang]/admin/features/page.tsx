import type { Metadata } from "next";
import { Suspense } from "react";
import { FeatureForm } from "@/app/[lang]/admin/features/feature-form";
import { requirePermission } from "@/lib/auth";
import { getFeatureSettings } from "@/lib/data/features";
import { setupStatus } from "@/lib/setup";

export const metadata: Metadata = { title: "Features" };

export default function Page() {
  return (
    <>
      <h1 className="text-2xl font-bold">Features</h1>
      <p className="mt-1 text-muted">Site-wide switches, and what still needs an outside account before it works.</p>
      <Suspense fallback={<p className="mt-6 text-muted">Loading…</p>}>
        <Features />
      </Suspense>
    </>
  );
}

async function Features() {
  await requirePermission("staff.manage");
  const settings = await getFeatureSettings();
  return (
    <div className="mt-6 space-y-8">
      <FeatureForm initial={settings} />
      <section>
        <h2 className="text-lg font-semibold">Set-up checklist</h2>
        <p className="text-sm text-muted">
          Add these as environment variables in Vercel (type Secret), then redeploy. Until then the feature stays hidden.
        </p>
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white text-sm">
          {setupStatus().map((s) => (
            <li key={s.name} className="flex items-start justify-between gap-3 p-4">
              <span>
                <span className="font-medium">{s.name}</span>
                {!s.ready && <span className="block text-muted">Needs {s.needs}</span>}
              </span>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${s.ready ? "bg-green-50 text-whatsapp" : "bg-canvas text-muted"}`}>
                {s.ready ? "Ready" : "Not set up"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
