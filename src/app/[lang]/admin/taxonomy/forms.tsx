"use client";

import { useActionState, useState, useTransition } from "react";
import { type ActionState, addArea, addCategory, deleteMall, saveMall } from "@/app/[lang]/admin/actions";

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

type MallRow = {
  id: number;
  slug: string;
  name: string;
  area_slug: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  sort_order: number;
};

// One form for adding (no mall) and editing (with mall).
export function MallForm({ mall, areas }: { mall?: MallRow; areas: { slug: string; name: string; indent: boolean }[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveMall, {});
  return (
    <form action={action} className="grid gap-2 text-sm sm:grid-cols-2">
      {mall && <input type="hidden" name="id" value={mall.id} />}
      <input name="name" required defaultValue={mall?.name} placeholder="Mall name, e.g. Mid Valley Megamall" className={input} />
      <select name="area" defaultValue={mall?.area_slug ?? ""} className={input} aria-label="Area">
        <option value="">Area…</option>
        {areas.map((a) => <option key={a.slug} value={a.slug}>{a.indent ? `— ${a.name}` : a.name}</option>)}
      </select>
      <input name="address" defaultValue={mall?.address ?? ""} placeholder="Address" className={`${input} sm:col-span-2`} />
      <input name="lat" defaultValue={mall?.lat ?? ""} placeholder="Latitude, e.g. 3.1179" className={input} />
      <input name="lng" defaultValue={mall?.lng ?? ""} placeholder="Longitude, e.g. 101.6773" className={input} />
      {mall && (
        <>
          <input name="slug" defaultValue={mall.slug} placeholder="URL slug" className={input} aria-label="URL slug" />
          <input name="sortOrder" defaultValue={mall.sort_order} placeholder="Order" className={input} aria-label="Order (lower shows first)" />
        </>
      )}
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        <button disabled={pending} className="rounded-full bg-ink px-4 py-2 text-white disabled:opacity-50">
          {mall ? "Save mall" : "Add mall"}
        </button>
        {mall && <DeleteMallButton id={mall.id} name={mall.name} />}
        <Result state={state} />
      </div>
    </form>
  );
}

function DeleteMallButton({ id, name }: { id: number; name: string }) {
  const [state, setState] = useState<ActionState>({});
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  if (state.message) return <span className="text-whatsapp">{state.message}</span>;
  return confirming ? (
    <span className="flex items-center gap-2">
      Delete {name}? Its shops stay listed.
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => setState(await deleteMall(id)))}
        className="rounded-full bg-brand-700 px-3 py-1 text-white disabled:opacity-50"
      >
        Delete
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="underline">Cancel</button>
      <Result state={state} />
    </span>
  ) : (
    <button type="button" onClick={() => setConfirming(true)} className="text-muted underline">Delete</button>
  );
}
