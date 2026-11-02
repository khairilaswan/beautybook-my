import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { fmt } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.pending.metaTitle, robots: { index: false } };
}

// Signed-in accounts that aren't approved yet land here (see src/proxy.ts).
export default async function PendingPage() {
  const { t } = await getI18n();
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
        <Pending />
      </Suspense>
    </div>
  );
}

async function Pending() {
  const [user, { t, href }] = await Promise.all([requireUser("/pending"), getI18n()]);
  const supabase = await createClient();
  const { data } = await supabase.from("member_access").select("status").eq("user_id", user.id).maybeSingle();
  const rejected = data?.status === "rejected";
  return (
    <>
      <h1 className="text-2xl font-bold">{rejected ? t.pending.rejectedTitle : t.pending.title}</h1>
      <p className="mt-3 text-muted">{rejected ? t.pending.rejectedBody : t.pending.body}</p>
      <p className="mt-3 text-sm text-muted">{fmt(t.pending.signedInAs, { who: user.email ?? user.phone ?? "" })}</p>
      <div className="mt-6 flex gap-2">
        {!rejected && (
          <Link href={href("/pending")} prefetch={false} className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white">
            {t.pending.checkAgain}
          </Link>
        )}
        <form action="/auth/signout" method="post">
          <button className="rounded-full border border-line bg-white px-4 py-2 text-sm">{t.common.signOut}</button>
        </form>
      </div>
    </>
  );
}
