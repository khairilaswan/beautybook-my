"use client";

import { useActionState, useTransition } from "react";
import type { ActionState } from "@/app/[lang]/admin/actions";
import { grantFeatured, setFeaturedStatus } from "@/app/[lang]/admin/growth-actions";
import type { Area, Category } from "@/lib/types";

const input = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";

export function FeaturedButtons({ id, status }: { id: number; status: string }) {
  const [pending, start] = useTransition();
  return (
    <span className="flex gap-2">
      {status === "requested" && (
        <button disabled={pending} onClick={() => start(() => setFeaturedStatus(id, "active"))} className="rounded-full bg-ink px-3 py-1 text-white">
          Start 30 days
        </button>
      )}
      <button disabled={pending} onClick={() => start(() => setFeaturedStatus(id, "cancelled"))} className="rounded-full border border-line px-3 py-1">
        {status === "active" ? "End now" : "Cancel"}
      </button>
    </span>
  );
}

export function GrantFeaturedForm({ areas, categories }: { areas: Area[]; categories: Category[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(grantFeatured, {});
  return (
    <form action={action} className="mt-2 grid gap-3 rounded-2xl border border-line bg-white p-5 text-sm sm:grid-cols-2">
      <label className="block sm:col-span-2">
        <span className="font-medium">Shop link or slug</span>
        <input name="listingSlug" required placeholder="https://beautybook.my/salon/…" className={input} />
      </label>
      <label className="block">
        <span className="font-medium">Area</span>
        <select name="areaId" className={input}>
          <option value="">Everywhere</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="font-medium">Service</span>
        <select name="categoryId" className={input}>
          <option value="">All services</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name_en}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="font-medium">Days</span>
        <input name="days" type="number" min={1} max={365} defaultValue={30} className={input} />
      </label>
      <div className="flex items-end gap-3">
        <button disabled={pending} className="rounded-full bg-ink px-4 py-2 font-medium text-white disabled:opacity-60">Feature it</button>
        {state.error && <span role="alert" className="text-brand-700">{state.error}</span>}
        {state.message && <span className="text-whatsapp">{state.message}</span>}
      </div>
    </form>
  );
}
