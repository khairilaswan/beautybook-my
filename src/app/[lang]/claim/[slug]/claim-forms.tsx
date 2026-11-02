"use client";

import { useActionState } from "react";
import { type ClaimState, startClaim, submitDocumentClaim, verifyClaim } from "@/app/[lang]/claim/actions";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { uploadFile } from "@/lib/supabase/browser";

const input = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";

type Props = { listingId: string; slug: string; userId: string; maskedPhone: string | null; canUseCode: boolean };

export function ClaimForms({ listingId, slug, userId, maskedPhone, canUseCode }: Props) {
  const { t } = useI18n();
  const c = t.claim;
  const [codeState, codeAction, codePending] = useActionState<ClaimState, FormData>(
    async (prev, form) => (form.get("intent") === "verify" ? verifyClaim(prev, form) : startClaim(prev, form)),
    {},
  );
  const [docState, docAction, docPending] = useActionState<ClaimState, FormData>(async (prev, form) => {
    const file = form.get("evidence");
    if (!(file instanceof File) || file.size === 0) return { error: c.errors.attach };
    const uploaded = await uploadFile("claim-evidence", userId, file, 10 * 1024 * 1024);
    if ("error" in uploaded) return { error: uploaded.error };
    form.delete("evidence");
    form.set("evidencePath", uploaded.path);
    return submitDocumentClaim(prev, form);
  }, {});

  return (
    <div className="space-y-8">
      {canUseCode && (
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold">{c.fastest}</h2>
          <p className="mt-1 text-sm text-muted">{fmt(c.fastestBody, { phone: maskedPhone ?? "" })}</p>
          <form action={codeAction} className="mt-4 space-y-3">
            <input type="hidden" name="listingId" value={listingId} />
            <input type="hidden" name="slug" value={slug} />
            {codeState.claimId ? (
              <>
                <p className="text-sm">{fmt(c.codeSent, { to: codeState.sentTo ?? "" })}</p>
                <label className="block text-sm">
                  <span className="font-medium">{c.code}</span>
                  <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required className={input} />
                </label>
                <div className="flex gap-2">
                  <button name="intent" value="verify" disabled={codePending} className="flex-1 rounded-xl bg-ink px-4 py-3 font-medium text-white disabled:opacity-60">
                    {c.verify}
                  </button>
                  <button name="intent" value="send" formNoValidate disabled={codePending} className="rounded-xl border border-line px-4 py-3 text-sm">
                    {c.resend}
                  </button>
                </div>
              </>
            ) : (
              <button name="intent" value="send" disabled={codePending} className="w-full rounded-xl bg-whatsapp px-4 py-3 font-semibold text-white disabled:opacity-60">
                {codePending ? c.sending : c.sendCode}
              </button>
            )}
            {codeState.error && <p role="alert" className="text-sm text-brand-700">{codeState.error}</p>}
          </form>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">{canUseCode ? c.noCode : c.sendProof}</h2>
        <p className="mt-1 text-sm text-muted">{c.proofBody}</p>
        {docState.done ? (
          <p className="mt-4 text-sm text-whatsapp">{c.thanks}</p>
        ) : (
          <form action={docAction} className="mt-4 space-y-3">
            <input type="hidden" name="listingId" value={listingId} />
            <input type="hidden" name="slug" value={slug} />
            <label className="block text-sm">
              <span className="font-medium">{c.document}</span>
              <input name="evidence" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required className={input} />
            </label>
            <label className="block text-sm">
              <span className="font-medium">{c.anything}</span>
              <textarea name="note" maxLength={1000} rows={3} className={input} />
            </label>
            {docState.error && <p role="alert" className="text-sm text-brand-700">{docState.error}</p>}
            <button disabled={docPending} className="w-full rounded-xl border border-ink px-4 py-3 font-medium disabled:opacity-60">
              {c.submit}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
