import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { listingPath } from "@/lib/paths";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.growth.gift.title, robots: { index: false } };
}

export default async function VoucherPage({ params }: PageProps<"/[lang]/account/vouchers/[id]">) {
  const { t } = await getI18n();
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Suspense fallback={<p className="text-muted">{t.common.loading}</p>}>
        <Voucher params={params} />
      </Suspense>
    </div>
  );
}

// The buyer's copy of a voucher, with a WhatsApp message to send it on.
async function Voucher({ params }: { params: PageProps<"/[lang]/account/vouchers/[id]">["params"] }) {
  const [{ id }, { locale, t, href }] = await Promise.all([params, getI18n()]);
  const g = t.growth.gift;
  const user = await requireUser(`/account/vouchers/${id}`);
  const supabase = await createClient();
  const { data: v } = await supabase
    .from("gift_vouchers")
    .select("code, amount_rm, recipient_name, buyer_name, message, status, expires_at, listings ( slug, name )")
    .eq("id", id)
    .eq("buyer_id", user.id)
    .maybeSingle();
  if (!v) notFound();
  const shop = (v as unknown as { listings: { slug: string; name: string } }).listings;
  const until = formatDate(v.expires_at, locale);
  const text = [
    `🎁 ${fmt(g.share.intro, { name: v.recipient_name, amount: `RM${v.amount_rm}`, shop: shop.name })}${v.message ? `: ${v.message}` : "!"}`,
    fmt(g.share.code, { code: v.code, date: until }),
    fmt(g.share.book, { url: `${siteUrl}${href(listingPath(shop.slug))}` }),
    fmt(g.share.from, { name: v.buyer_name }),
  ].join("\n");
  return (
    <>
      <h1 className="text-2xl font-bold">{g.title}</h1>
      {v.status === "pending_payment" ? (
        <p className="mt-4 rounded-2xl bg-canvas p-4 text-sm">
          {g.waiting}
        </p>
      ) : (
        <div className="mt-4 rounded-2xl border-2 border-dashed border-brand-200 bg-white p-6 text-center">
          <p className="text-sm text-muted">{shop.name}</p>
          <p className="mt-1 text-4xl font-bold">RM{v.amount_rm}</p>
          <p className="mt-1">{fmt(g.forName, { name: v.recipient_name })}</p>
          <p className="mt-4 font-mono text-2xl tracking-widest">{v.code}</p>
          <p className="mt-2 text-sm text-muted">
            {v.status === "redeemed" ? g.used : fmt(g.validUntil, { date: until })}
          </p>
        </div>
      )}
      {v.status === "active" && (
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          className="mt-4 flex w-full items-center justify-center rounded-xl bg-whatsapp px-4 py-3 font-semibold text-white"
        >
          {g.send}
        </a>
      )}
      <p className="mt-4 text-sm">
        <Link href={href("/account")} className="underline">{g.back}</Link>
      </p>
    </>
  );
}
