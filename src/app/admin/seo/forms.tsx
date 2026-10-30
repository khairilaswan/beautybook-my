"use client";

import { useActionState, useTransition } from "react";
import { type ActionState, addRedirect, deleteRedirect } from "@/app/admin/actions";

export function RedirectForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(addRedirect, {});
  return (
    <form action={action} className="mt-4 flex flex-wrap items-center gap-2 text-sm">
      <input name="from" required placeholder="/shop/old-name" className="rounded-xl border border-line px-3 py-2" />
      <input name="to" required placeholder="/shop/new-name" className="rounded-xl border border-line px-3 py-2" />
      <button disabled={pending} className="rounded-full bg-ink px-4 py-2 text-white disabled:opacity-50">Add redirect</button>
      {state.error && <span role="alert" className="text-brand-700">{state.error}</span>}
      {state.message && <span className="text-whatsapp">{state.message}</span>}
    </form>
  );
}

export function DeleteRedirect({ from }: { from: string }) {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} onClick={() => start(() => deleteRedirect(from))} className="text-muted underline">
      Delete
    </button>
  );
}
