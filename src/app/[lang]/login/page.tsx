import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForms } from "@/app/[lang]/login/login-forms";
import { localePath } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { getLoginMethods } from "@/lib/login-methods";
import { safeNext } from "@/lib/safe-next";
import { membersOnly } from "@/lib/site-access";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.login.metaTitle, robots: { index: false } };
}

export default async function LoginPage({ searchParams }: PageProps<"/[lang]/login">) {
  const { t } = await getI18n();
  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-2xl font-bold">{t.login.title}</h1>
      <p className="mt-1 text-muted">{membersOnly ? t.login.membersOnly : t.login.lead}</p>
      <div className="mt-8">
        <Suspense>
          <Forms searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function Forms({ searchParams }: { searchParams: PageProps<"/[lang]/login">["searchParams"] }) {
  const [params, { locale, t }] = await Promise.all([searchParams, getI18n()]);
  const next = safeNext(typeof params.next === "string" ? params.next : null, localePath(locale, "/account"));
  const error = typeof params.error === "string" ? params.error : null;
  const methods = await getLoginMethods();
  return (
    <>
      {error && <p role="alert" className="mb-4 rounded-xl bg-brand-50 p-3 text-sm text-brand-700">{error}</p>}
      {params.invited && (
        <p className="mb-4 rounded-xl bg-green-50 p-3 text-sm">
          {t.growth.account.invited}
        </p>
      )}
      <LoginForms next={next} methods={methods} />
    </>
  );
}
