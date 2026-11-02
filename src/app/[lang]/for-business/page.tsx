import type { Metadata } from "next";
import Link from "next/link";
import { AddBusinessForm } from "@/app/[lang]/for-business/add-business-form";
import { getAreas, getCategories } from "@/lib/data/directory";
import { alternatesFor } from "@/lib/i18n/config";
import { areaName, categoryName } from "@/lib/i18n/names";
import { getI18n } from "@/lib/i18n/server";
import { whatsAppCodesEnabled } from "@/lib/whatsapp-cloud";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getI18n();
  return {
    title: t.forBusiness.metaTitle,
    description: t.forBusiness.metaDescription,
    alternates: alternatesFor(locale, "/for-business"),
  };
}

export default async function ForBusinessPage() {
  const [categories, areas, { locale, t, href }] = await Promise.all([getCategories(), getAreas(), getI18n()]);
  const byCode = whatsAppCodesEnabled();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
        {t.forBusiness.title}
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">{t.forBusiness.lead}</p>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="text-xl font-semibold">{t.forBusiness.listedTitle}</h2>
          <p className="mt-1 text-muted">{t.forBusiness.listedBody}</p>
          <form action={href("/search")} className="mt-4 flex gap-2">
            <input name="q" required placeholder={t.forBusiness.shopName} className="w-full rounded-xl border border-line px-3 py-2" />
            <button className="rounded-xl bg-ink px-4 py-2 font-medium text-white">{t.forBusiness.find}</button>
          </form>
          <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm">
            <li>{t.forBusiness.step1}</li>
            {byCode ? (
              <>
                <li>{t.forBusiness.stepCode1}</li>
                <li>{t.forBusiness.stepCode2}</li>
              </>
            ) : (
              <>
                <li>{t.forBusiness.stepDoc1}</li>
                <li>{t.forBusiness.stepDoc2}</li>
              </>
            )}
          </ol>
        </section>

        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="text-xl font-semibold">{t.forBusiness.addTitle}</h2>
          <p className="mt-1 text-muted">{byCode ? t.forBusiness.addByCode : t.forBusiness.addByDoc}</p>
          <AddBusinessForm
            byCode={byCode}
            categories={categories.map((c) => ({ slug: c.slug, name: categoryName(c, locale) }))}
            areas={areas.filter((a) => a.type !== "state").map((a) => ({ slug: a.slug, name: areaName(a, locale) }))}
          />
        </section>
      </div>

      <p className="mt-10 text-sm text-muted">
        {t.forBusiness.removal}{" "}
        <Link href={href("/privacy#removal")} className="underline">{t.forBusiness.removalLink}</Link>.
      </p>
    </div>
  );
}
