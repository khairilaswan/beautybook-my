import type { Metadata } from "next";
import Link from "next/link";
import { alternatesFor } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getI18n();
  return {
    title: t.privacy.metaTitle,
    description: t.privacy.metaDescription,
    alternates: alternatesFor(locale, "/privacy"),
  };
}

export default async function PrivacyPage() {
  const { t, href } = await getI18n();
  const p = t.privacy;
  return (
    <article className="mx-auto max-w-2xl space-y-6 px-4 py-10 leading-relaxed">
      <h1 className="text-3xl font-bold">{p.title}</h1>
      <p className="rounded-xl bg-brand-50 p-3 text-sm">{p.draft}</p>
      {p.translationNote && <p className="text-sm text-muted">{p.translationNote}</p>}
      <section>
        <h2 className="text-xl font-semibold">{p.collectTitle}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {p.collect.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-xl font-semibold">{p.useTitle}</h2>
        <p className="mt-2">{p.use}</p>
      </section>
      <section id="removal">
        <h2 className="text-xl font-semibold">{p.removalTitle}</h2>
        <p className="mt-2">{p.removal}</p>
      </section>
      <section>
        <h2 className="text-xl font-semibold">{p.accountTitle}</h2>
        <p className="mt-2">
          {p.accountBefore}{" "}
          <Link href={href("/account")} className="underline">
            {p.accountLink}
          </Link>
          {p.accountAfter}
        </p>
      </section>
    </article>
  );
}
