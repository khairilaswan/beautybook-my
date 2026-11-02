"use client";

import { useActionState } from "react";
import { type ActionState, saveListing } from "@/app/admin/actions";
import type { Area, Attribute, Category } from "@/lib/types";

const input = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";

export type AdminListing = {
  id: string;
  name: string;
  slug: string;
  status: string;
  area_slug: string | null;
  address: string | null;
  postcode: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  description: string | null;
  price_level: number | null;
  gender: string | null;
  google_place_id: string | null;
  category_slugs: string[];
  primary_category: string | null;
  attribute_ids: number[];
};

type Props = { listing: AdminListing | null; areas: Area[]; categories: Category[]; attributes: Attribute[] };

export function ListingForm({ listing, areas, categories, attributes }: Props) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveListing, {});
  const l = listing;
  return (
    <form action={action} className="space-y-4 rounded-2xl border border-line bg-white p-5 text-sm">
      {l && <input type="hidden" name="id" value={l.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="font-medium">Name</span>
          <input name="name" required defaultValue={l?.name} className={input} /></label>
        <label className="block"><span className="font-medium">URL slug</span>
          <input name="slug" defaultValue={l?.slug} placeholder="made from name + area" className={input} /></label>
        <label className="block"><span className="font-medium">Status</span>
          <select name="status" defaultValue={l?.status ?? "active"} className={input}>
            {["active", "hidden", "closed", "archived"].map((s) => <option key={s}>{s}</option>)}
          </select></label>
        <label className="block"><span className="font-medium">Area</span>
          <select name="area" required defaultValue={l?.area_slug ?? ""} className={input}>
            <option value="">Choose…</option>
            {areas.map((a) => <option key={a.slug} value={a.slug}>{a.type === "area" ? `— ${a.name}` : a.name}</option>)}
          </select></label>
        <label className="block"><span className="font-medium">Main category</span>
          <select name="category" required defaultValue={l?.primary_category ?? ""} className={input}>
            <option value="">Choose…</option>
            {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name_en}</option>)}
          </select></label>
        <fieldset><legend className="font-medium">Other categories</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {categories.map((c) => (
              <label key={c.slug} className="flex items-center gap-1">
                <input type="checkbox" name="otherCategories" value={c.slug} defaultChecked={l?.category_slugs.includes(c.slug) && l.primary_category !== c.slug} />
                {c.name_en}
              </label>
            ))}
          </div></fieldset>
        <label className="block sm:col-span-2"><span className="font-medium">Address</span>
          <input name="address" defaultValue={l?.address ?? ""} className={input} /></label>
        <label className="block"><span className="font-medium">Postcode</span>
          <input name="postcode" defaultValue={l?.postcode ?? ""} className={input} /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className="font-medium">Latitude</span>
            <input name="lat" defaultValue={l?.lat ?? ""} className={input} /></label>
          <label className="block"><span className="font-medium">Longitude</span>
            <input name="lng" defaultValue={l?.lng ?? ""} className={input} /></label>
        </div>
        <label className="block"><span className="font-medium">Phone</span>
          <input name="phone" defaultValue={l?.phone ?? ""} className={input} /></label>
        <label className="block"><span className="font-medium">WhatsApp (if different)</span>
          <input name="whatsapp" defaultValue={l?.whatsapp ?? ""} className={input} /></label>
        <label className="block"><span className="font-medium">Website</span>
          <input name="website" defaultValue={l?.website ?? ""} className={input} /></label>
        <label className="block"><span className="font-medium">Instagram</span>
          <input name="instagram" defaultValue={l?.instagram ?? ""} className={input} /></label>
        <label className="block"><span className="font-medium">Facebook</span>
          <input name="facebook" defaultValue={l?.facebook ?? ""} className={input} /></label>
        <label className="block"><span className="font-medium">Google place ID</span>
          <input name="googlePlaceId" defaultValue={l?.google_place_id ?? ""} className={input} /></label>
        <label className="block"><span className="font-medium">Price level</span>
          <select name="priceLevel" defaultValue={l?.price_level ?? ""} className={input}>
            <option value="">Not set</option>
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{"$".repeat(n)}</option>)}
          </select></label>
        <label className="block"><span className="font-medium">Customers</span>
          <select name="gender" defaultValue={l?.gender ?? ""} className={input}>
            <option value="">Not set</option>
            <option value="men">Men</option>
            <option value="women">Women</option>
            <option value="unisex">Men and women</option>
          </select></label>
        <label className="block sm:col-span-2"><span className="font-medium">Description</span>
          <textarea name="description" rows={3} defaultValue={l?.description ?? ""} className={input} /></label>
        <fieldset className="sm:col-span-2"><legend className="font-medium">Attributes</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {attributes.map((a) => (
              <label key={a.id} className="flex items-center gap-1 rounded-full border border-line px-2 py-0.5">
                <input type="checkbox" name="attributes" value={a.id} defaultChecked={l?.attribute_ids.includes(a.id)} />
                {a.name_en}
              </label>
            ))}
          </div></fieldset>
      </div>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="rounded-full bg-ink px-5 py-2 font-medium text-white disabled:opacity-60">
          {l ? "Save" : "Create listing"}
        </button>
        {state.error && <span role="alert" className="text-brand-700">{state.error}</span>}
        {state.message && <span className="text-whatsapp">{state.message}</span>}
      </div>
    </form>
  );
}
