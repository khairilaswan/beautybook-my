"use client";

import { useActionState } from "react";
import { updateProfile } from "@/app/account/actions";

const input = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";

export function ProfileForm(props: { displayName: string; phone: string; preferredLang: string }) {
  const [state, action, pending] = useActionState<{ message?: string }, FormData>(updateProfile, {});
  return (
    <form action={action} className="mt-3 grid max-w-md gap-3">
      <label className="text-sm">
        <span className="font-medium">Name</span>
        <input name="displayName" defaultValue={props.displayName} maxLength={80} className={input} />
      </label>
      <label className="text-sm">
        <span className="font-medium">Mobile number</span>
        <input name="phone" type="tel" defaultValue={props.phone} className={input} />
      </label>
      <label className="text-sm">
        <span className="font-medium">Language</span>
        <select name="preferredLang" defaultValue={props.preferredLang} className={input}>
          <option value="en">English</option>
          <option value="ms">Bahasa Melayu</option>
          <option value="zh">中文</option>
        </select>
      </label>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          Save
        </button>
        {state.message && <span className="text-sm text-muted">{state.message}</span>}
      </div>
    </form>
  );
}
