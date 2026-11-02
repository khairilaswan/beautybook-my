"use client";

import { useActionState } from "react";
import { type ClaimState, startClaim, submitDocumentClaim, verifyClaim } from "@/app/claim/actions";
import { uploadFile } from "@/lib/supabase/browser";

const input = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";

type Props = { listingId: string; slug: string; userId: string; maskedPhone: string | null; canUseCode: boolean };

export function ClaimForms({ listingId, slug, userId, maskedPhone, canUseCode }: Props) {
  const [codeState, codeAction, codePending] = useActionState<ClaimState, FormData>(
    async (prev, form) => (form.get("intent") === "verify" ? verifyClaim(prev, form) : startClaim(prev, form)),
    {},
  );
  const [docState, docAction, docPending] = useActionState<ClaimState, FormData>(async (prev, form) => {
    const file = form.get("evidence");
    if (!(file instanceof File) || file.size === 0) return { error: "Please attach a document or photo." };
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
          <h2 className="font-semibold">Fastest: get a code on WhatsApp</h2>
          <p className="mt-1 text-sm text-muted">
            We&apos;ll send a 6-digit code to the shop&apos;s number {maskedPhone}. Enter it here and you&apos;re in.
          </p>
          <form action={codeAction} className="mt-4 space-y-3">
            <input type="hidden" name="listingId" value={listingId} />
            <input type="hidden" name="slug" value={slug} />
            {codeState.claimId ? (
              <>
                <p className="text-sm">Code sent to {codeState.sentTo}. It expires in 10 minutes.</p>
                <label className="block text-sm">
                  <span className="font-medium">6-digit code</span>
                  <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required className={input} />
                </label>
                <div className="flex gap-2">
                  <button name="intent" value="verify" disabled={codePending} className="flex-1 rounded-xl bg-ink px-4 py-3 font-medium text-white disabled:opacity-60">
                    Verify and claim
                  </button>
                  <button name="intent" value="send" formNoValidate disabled={codePending} className="rounded-xl border border-line px-4 py-3 text-sm">
                    Resend
                  </button>
                </div>
              </>
            ) : (
              <button name="intent" value="send" disabled={codePending} className="w-full rounded-xl bg-whatsapp px-4 py-3 font-semibold text-white disabled:opacity-60">
                {codePending ? "Sending…" : "Send code by WhatsApp"}
              </button>
            )}
            {codeState.error && <p role="alert" className="text-sm text-brand-700">{codeState.error}</p>}
          </form>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">{canUseCode ? "Can't get the code?" : "Send us proof"}</h2>
        <p className="mt-1 text-sm text-muted">
          Upload your SSM certificate, a business card or a photo of the shopfront. Our team reviews claims within 2
          working days.
        </p>
        {docState.done ? (
          <p className="mt-4 text-sm text-whatsapp">Thanks! We&apos;ll let you know once it&apos;s reviewed.</p>
        ) : (
          <form action={docAction} className="mt-4 space-y-3">
            <input type="hidden" name="listingId" value={listingId} />
            <input type="hidden" name="slug" value={slug} />
            <label className="block text-sm">
              <span className="font-medium">Document or photo</span>
              <input name="evidence" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required className={input} />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Anything we should know? (optional)</span>
              <textarea name="note" maxLength={1000} rows={3} className={input} />
            </label>
            {docState.error && <p role="alert" className="text-sm text-brand-700">{docState.error}</p>}
            <button disabled={docPending} className="w-full rounded-xl border border-ink px-4 py-3 font-medium disabled:opacity-60">
              Submit for review
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
