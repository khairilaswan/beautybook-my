"use client";

import { useActionState } from "react";
import { updateProfile } from "@/app/[lang]/account/actions";
import { useI18n } from "@/lib/i18n/client";
import { LOCALES, LOCALE_NAMES } from "@/lib/i18n/config";

const input = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";

export function ProfileForm(props: { displayName: string; phone: string; preferredLang: string }) {
  const [state, action, pending] = useActionState<{ message?: string }, FormData>(updateProfile, {});
  const { t } = useI18n();
  return (
    <form action={action} className="mt-3 grid max-w-md gap-3">
      <label className="text-sm">
        <span className="font-medium">{t.profile.name}</span>
        <input name="displayName" defaultValue={props.displayName} maxLength={80} className={input} />
      </label>
      <label className="text-sm">
        <span className="font-medium">{t.profile.mobile}</span>
        <input name="phone" type="tel" defaultValue={props.phone} className={input} />
      </label>
      <label className="text-sm">
        <span className="font-medium">{t.profile.language}</span>
        <select name="preferredLang" defaultValue={props.preferredLang} className={input}>
          {LOCALES.map((l) => (
            <option key={l} value={l}>{LOCALE_NAMES[l]}</option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {t.common.save}
        </button>
        {state.message && <span className="text-sm text-muted">{state.message}</span>}
      </div>
    </form>
  );
}
