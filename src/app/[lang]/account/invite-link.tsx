"use client";

import { useState } from "react";
import { siteUrl } from "@/lib/env";
import { useI18n } from "@/lib/i18n/client";
import { fmt, localePath } from "@/lib/i18n/config";

export function InviteLink({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const { locale, t } = useI18n();
  const g = t.growth.account;
  const url = `${siteUrl}${localePath(locale, `/invite/${code}`)}`;
  const text = fmt(g.inviteMessage, { url });
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      <code className="rounded-xl border border-line bg-white px-3 py-2">{url}</code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
        className="rounded-full border border-line px-3 py-1.5"
      >
        {copied ? g.copied : g.copy}
      </button>
      <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} className="rounded-full bg-whatsapp px-3 py-1.5 text-white">
        {g.shareWhatsApp}
      </a>
    </div>
  );
}
