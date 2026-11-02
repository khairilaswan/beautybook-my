"use client";

import { useActionState } from "react";
import { type ActionState, addArea, addCategory } from "@/app/admin/actions";

const input = "rounded-xl border border-line bg-white px-3 py-2";

function Result({ state }: { state: ActionState }) {
  if (state.error) return <span role="alert" className="text-brand-700">{state.error}</span>;
  if (state.message) return <span className="text-whatsapp">{state.message}</span>;
  return null;
}

export function AddCategoryForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(addCategory, {});
  return (
    <form action={action} className="mt-4 flex flex-wrap items-center gap-2 text-sm">
      <input name="nameEn" required placeholder="English name" className={input} />
      <input name="nameMs" required placeholder="Malay name" className={input} />
      <button disabled={pending} className="rounded-full bg-ink px-4 py-2 text-white disabled:opacity-50">Add category</button>
      <Result state={state} />
    </form>
  );
}

export function AddAreaForm({ parents }: { parents: { slug: string; name: string }[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addArea, {});
  return (
    <form action={action} className="mt-4 flex flex-wrap items-center gap-2 text-sm">
      <input name="name" required placeholder="Area name" className={input} />
      <select name="parent" className={input} defaultValue="">
        <option value="">Top level city</option>
        {parents.map((p) => <option key={p.slug} value={p.slug}>Inside {p.name}</option>)}
      </select>
      <button disabled={pending} className="rounded-full bg-ink px-4 py-2 text-white disabled:opacity-50">Add area</button>
      <Result state={state} />
    </form>
  );
}
