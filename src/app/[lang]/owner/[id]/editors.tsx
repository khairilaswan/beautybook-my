"use client";

import Image from "next/image";
import { useActionState, useState, useTransition } from "react";
import {
  addPhoto,
  type FormState,
  removePhoto,
  saveHours,
  saveServices,
  updateListingDetails,
} from "@/app/owner/actions";
import { photoUrl } from "@/lib/format";
import { WEEKDAYS, hhmm } from "@/lib/hours";
import { uploadFile } from "@/lib/supabase/browser";
import type { Attribute } from "@/lib/types";

const input = "w-full rounded-xl border border-line bg-white px-3 py-2";
const saveButton = "rounded-full bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-60";

function Status({ state }: { state: FormState }) {
  if (state.error) return <span role="alert" className="text-sm text-brand-700">{state.error}</span>;
  if (state.message) return <span className="text-sm text-whatsapp">{state.message}</span>;
  return null;
}

type DetailsProps = {
  listing: {
    id: string;
    slug: string;
    description: string | null;
    website: string | null;
    instagram: string | null;
    facebook: string | null;
    price_level: number | null;
    gender: string | null;
  };
  attributes: Attribute[];
  selectedAttributes: number[];
};

export function DetailsForm({ listing, attributes, selectedAttributes }: DetailsProps) {
  const [state, action, pending] = useActionState(updateListingDetails, {});
  return (
    <form action={action} className="mt-3 space-y-4 rounded-2xl border border-line bg-white p-5">
      <input type="hidden" name="listingId" value={listing.id} />
      <input type="hidden" name="slug" value={listing.slug} />
      <label className="block text-sm">
        <span className="font-medium">About your shop</span>
        <textarea name="description" defaultValue={listing.description ?? ""} rows={4} maxLength={2000} className={`mt-1 ${input}`} />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        {(["instagram", "facebook", "website"] as const).map((k) => (
          <label key={k} className="block text-sm">
            <span className="font-medium capitalize">{k}</span>
            <input name={k} type="url" defaultValue={listing[k] ?? ""} placeholder="https://" className={`mt-1 ${input}`} />
          </label>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">Price level</span>
          <select name="priceLevel" defaultValue={listing.price_level ?? ""} className={`mt-1 ${input}`}>
            <option value="">Not set</option>
            <option value="1">$ Budget</option>
            <option value="2">$$ Mid-range</option>
            <option value="3">$$$ Premium</option>
            <option value="4">$$$$ Luxury</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium">Customers</span>
          <select name="gender" defaultValue={listing.gender ?? ""} className={`mt-1 ${input}`}>
            <option value="">Not set</option>
            <option value="men">Men</option>
            <option value="women">Women</option>
            <option value="unisex">Men and women</option>
          </select>
        </label>
      </div>
      <fieldset className="text-sm">
        <legend className="font-medium">Good to know</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {attributes.map((a) => (
            <label key={a.id} className="flex items-center gap-2 rounded-full border border-line px-3 py-1">
              <input type="checkbox" name="attributes" value={a.id} defaultChecked={selectedAttributes.includes(a.id)} />
              {a.name_en}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center gap-3">
        <button disabled={pending} className={saveButton}>Save details</button>
        <Status state={state} />
      </div>
    </form>
  );
}

type ServiceRow = { name: string; price_from: string; price_to: string; duration_min: string };

const toNumber = (v: string) => (v.trim() === "" ? null : Number(v));

export function ServicesEditor(props: {
  listingId: string;
  slug: string;
  initial: { name: string; price_from: number | null; price_to: number | null; duration_min: number | null }[];
}) {
  const [rows, setRows] = useState<ServiceRow[]>(
    props.initial.map((s) => ({
      name: s.name,
      price_from: s.price_from?.toString() ?? "",
      price_to: s.price_to?.toString() ?? "",
      duration_min: s.duration_min?.toString() ?? "",
    })),
  );
  const [state, setState] = useState<FormState>({});
  const [pending, start] = useTransition();
  const update = (i: number, key: keyof ServiceRow, value: string) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, [key]: value } : r)));

  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-line bg-white p-5">
      {rows.length === 0 && <p className="text-sm text-muted">No services yet. Customers see a standard menu until you add yours.</p>}
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_80px_80px_70px_auto] items-center gap-2 text-sm">
          <input aria-label="Service" value={r.name} onChange={(e) => update(i, "name", e.target.value)} placeholder="Service" className={input} />
          <input aria-label="Price from (RM)" value={r.price_from} onChange={(e) => update(i, "price_from", e.target.value)} placeholder="RM from" inputMode="decimal" className={input} />
          <input aria-label="Price to (RM)" value={r.price_to} onChange={(e) => update(i, "price_to", e.target.value)} placeholder="RM to" inputMode="decimal" className={input} />
          <input aria-label="Minutes" value={r.duration_min} onChange={(e) => update(i, "duration_min", e.target.value)} placeholder="min" inputMode="numeric" className={input} />
          <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label={`Remove ${r.name || "service"}`} className="px-2 text-muted hover:text-ink">
            ✕
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setRows([...rows, { name: "", price_from: "", price_to: "", duration_min: "" }])} className="rounded-full border border-line px-4 py-2 text-sm">
          Add service
        </button>
        <button
          type="button"
          disabled={pending}
          className={saveButton}
          onClick={() =>
            start(async () => {
              const payload = rows
                .filter((r) => r.name.trim())
                .map((r) => ({
                  name: r.name.trim(),
                  price_from: toNumber(r.price_from),
                  price_to: toNumber(r.price_to),
                  duration_min: toNumber(r.duration_min),
                }));
              if (payload.some((p) => [p.price_from, p.price_to, p.duration_min].some((n) => n !== null && Number.isNaN(n)))) {
                setState({ error: "Prices and minutes must be numbers." });
                return;
              }
              setState(await saveServices(props.listingId, props.slug, payload));
            })
          }
        >
          Save menu
        </button>
        <Status state={state} />
      </div>
    </div>
  );
}

type Slot = { opens: string; closes: string };
type Closure = { date_from: string; date_to: string; note: string };

export function HoursEditor(props: {
  listingId: string;
  slug: string;
  initialHours: { weekday: number; opens: string; closes: string }[];
  initialClosures: { date_from: string; date_to: string; note: string | null }[];
}) {
  const [days, setDays] = useState<Slot[][]>(
    WEEKDAYS.map((_, d) =>
      props.initialHours
        .filter((h) => h.weekday === d)
        .sort((a, b) => a.opens.localeCompare(b.opens))
        .map((h) => ({ opens: hhmm(h.opens), closes: hhmm(h.closes) })),
    ),
  );
  const [closures, setClosures] = useState<Closure[]>(
    props.initialClosures.map((c) => ({ ...c, note: c.note ?? "" })),
  );
  const [state, setState] = useState<FormState>({});
  const [pending, start] = useTransition();
  const setDay = (d: number, slots: Slot[]) => setDays(days.map((s, i) => (i === d ? slots : s)));

  return (
    <div className="mt-3 space-y-4 rounded-2xl border border-line bg-white p-5 text-sm">
      {[1, 2, 3, 4, 5, 6, 0].map((d) => (
        <div key={d} className="grid gap-2 sm:grid-cols-[110px_1fr]">
          <span className="pt-2 font-medium">{WEEKDAYS[d]}</span>
          <div className="space-y-2">
            {days[d].length === 0 && <p className="pt-2 text-muted">Closed</p>}
            {days[d].map((slot, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="time" aria-label={`${WEEKDAYS[d]} opens`} value={slot.opens} onChange={(e) => setDay(d, days[d].map((s, j) => (j === i ? { ...s, opens: e.target.value } : s)))} className="rounded-xl border border-line px-2 py-1" />
                <span>to</span>
                <input type="time" aria-label={`${WEEKDAYS[d]} closes`} value={slot.closes} onChange={(e) => setDay(d, days[d].map((s, j) => (j === i ? { ...s, closes: e.target.value } : s)))} className="rounded-xl border border-line px-2 py-1" />
                <button type="button" onClick={() => setDay(d, days[d].filter((_, j) => j !== i))} aria-label="Remove time slot" className="px-2 text-muted hover:text-ink">✕</button>
              </div>
            ))}
            <div className="flex gap-3">
              <button type="button" onClick={() => setDay(d, [...days[d], { opens: "10:00", closes: "20:00" }])} className="text-brand-700 underline">
                {days[d].length ? "Add break / second slot" : "Add hours"}
              </button>
              {d === 1 && (
                <button type="button" onClick={() => setDays(days.map((s, i) => (i === 0 ? s : days[1].map((x) => ({ ...x })))))} className="text-muted underline">
                  Copy Monday to all days
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
      <div>
        <p className="font-medium">Holiday closures</p>
        {closures.map((c, i) => (
          <div key={i} className="mt-2 flex flex-wrap items-center gap-2">
            <input type="date" aria-label="Closed from" value={c.date_from} onChange={(e) => setClosures(closures.map((x, j) => (j === i ? { ...x, date_from: e.target.value } : x)))} className="rounded-xl border border-line px-2 py-1" />
            <span>to</span>
            <input type="date" aria-label="Closed until" value={c.date_to} onChange={(e) => setClosures(closures.map((x, j) => (j === i ? { ...x, date_to: e.target.value } : x)))} className="rounded-xl border border-line px-2 py-1" />
            <input aria-label="Reason" value={c.note} placeholder="e.g. Hari Raya" onChange={(e) => setClosures(closures.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} className="rounded-xl border border-line px-2 py-1" />
            <button type="button" onClick={() => setClosures(closures.filter((_, j) => j !== i))} aria-label="Remove closure" className="px-2 text-muted">✕</button>
          </div>
        ))}
        <button type="button" onClick={() => setClosures([...closures, { date_from: "", date_to: "", note: "" }])} className="mt-2 text-brand-700 underline">
          Add closure
        </button>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          className={saveButton}
          onClick={() =>
            start(async () => {
              const hours = days.flatMap((slots, weekday) => slots.map((s) => ({ weekday, ...s })));
              const valid = closures.filter((c) => c.date_from && c.date_to).map((c) => ({ ...c, note: c.note.trim() || null }));
              setState(await saveHours(props.listingId, props.slug, hours, valid));
            })
          }
        >
          Save hours
        </button>
        <Status state={state} />
      </div>
    </div>
  );
}

export function PhotoManager(props: {
  listingId: string;
  slug: string;
  photos: { id: number; storage_path: string; status: string }[];
}) {
  const [state, setState] = useState<FormState>({});
  const [pending, start] = useTransition();
  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-line bg-white p-5">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {props.photos.map((p) => (
          <div key={p.id} className="group relative aspect-square overflow-hidden rounded-xl bg-brand-50">
            <Image src={photoUrl(p.storage_path)} alt="" fill sizes="20vw" className="object-cover" />
            <button
              type="button"
              disabled={pending}
              onClick={() => start(() => removePhoto(props.listingId, props.slug, p.id))}
              className="absolute right-1 top-1 rounded-full bg-white/90 px-2 text-sm"
              aria-label="Remove photo"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <label className="inline-block cursor-pointer rounded-full border border-line px-4 py-2 text-sm">
        {pending ? "Uploading…" : "Add photos"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          disabled={pending}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []).slice(0, 10);
            e.target.value = "";
            start(async () => {
              for (const file of files) {
                const uploaded = await uploadFile("listing-photos", props.listingId, file, 5 * 1024 * 1024);
                if ("error" in uploaded) {
                  setState({ error: uploaded.error });
                  return;
                }
                const result = await addPhoto(props.listingId, props.slug, uploaded.path);
                if (result.error) {
                  setState(result);
                  return;
                }
              }
              setState({ message: files.length === 1 ? "Photo added." : `${files.length} photos added.` });
            });
          }}
        />
      </label>
      <p className="text-xs text-muted">Only upload photos you took or have permission to use. Up to 5 MB each.</p>
      <Status state={state} />
    </div>
  );
}
