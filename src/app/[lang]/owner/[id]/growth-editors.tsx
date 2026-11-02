"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { type FormState, removePhoto } from "@/app/[lang]/owner/actions";
import {
  type CardLookup,
  addPortfolioPhoto,
  addPromotion,
  lookupCard,
  redeemLoyalty,
  redeemVoucher,
  removePromotion,
  replyToReview,
  requestFeatured,
  saveBookingSettings,
  saveLoyalty,
  savePackages,
  saveServiceAreas,
  saveStaff,
  saveVoucherSettings,
  setQuoteStatus,
} from "@/app/[lang]/owner/growth-actions";
import { Silhouette } from "@/components/silhouette";
import { formatDate, photoUrl } from "@/lib/format";
import { OCCASION_LABELS, PACKAGE_KIND_LABELS } from "@/lib/labels";
import { uploadFile } from "@/lib/supabase/browser";
import {
  type Area,
  type BookingSettings,
  type Category,
  type LoyaltyProgram,
  OCCASIONS,
  PACKAGE_KINDS,
  type Promotion,
  type ServicePackage,
  type VoucherSettings,
} from "@/lib/types";

const input = "w-full rounded-xl border border-line bg-white px-3 py-2";
const box = "mt-3 space-y-3 rounded-2xl border border-line bg-white p-5 text-sm";
const saveButton = "rounded-full bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-60";
const ghostButton = "rounded-full border border-line px-4 py-2 text-sm";

function Status({ state }: { state: FormState }) {
  if (state.error) return <span role="alert" className="text-sm text-brand-700">{state.error}</span>;
  if (state.message) return <span className="text-sm text-whatsapp">{state.message}</span>;
  return null;
}

function useSaver() {
  const [state, setState] = useState<FormState>({});
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<FormState | void>) =>
    start(async () => {
      const result = await fn();
      setState(result ?? {});
    });
  return { state, pending, run };
}

const num = (v: string) => (v.trim() === "" ? null : Number(v));

// ---------------------------------------------------------------------------

export function ServiceAreasEditor(props: { listingId: string; slug: string; areas: Area[]; selected: number[] }) {
  const [picked, setPicked] = useState(new Set(props.selected));
  const { state, pending, run } = useSaver();
  const cities = props.areas.filter((a) => a.type === "city");
  return (
    <div className={box}>
      <p className="text-muted">
        Freelance MUA, mobile nail tech or home barber? Tick the areas you travel to and you&apos;ll show up in their
        searches too.
      </p>
      {cities.map((city) => {
        const children = props.areas.filter((a) => a.parent_id === city.id);
        return (
          <fieldset key={city.id}>
            <legend className="font-medium">{city.name}</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {[city, ...children].map((a) => (
                <label key={a.id} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1">
                  <input
                    type="checkbox"
                    checked={picked.has(a.id)}
                    onChange={(e) => {
                      const next = new Set(picked);
                      if (e.target.checked) next.add(a.id);
                      else next.delete(a.id);
                      setPicked(next);
                    }}
                  />
                  {a.id === city.id ? `All of ${a.name}` : a.name}
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}
      <div className="flex items-center gap-3">
        <button disabled={pending} className={saveButton} onClick={() => run(() => saveServiceAreas(props.listingId, props.slug, [...picked]))}>
          Save areas
        </button>
        <Status state={state} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function PortfolioManager(props: {
  listingId: string;
  slug: string;
  photos: { id: number; storage_path: string; caption: string | null; category_id: number | null }[];
  categories: Category[];
}) {
  const { state, pending, run } = useSaver();
  const [categoryId, setCategoryId] = useState("");
  const [caption, setCaption] = useState("");
  return (
    <div className={box}>
      <p className="text-muted">Show your best work: nail sets, cuts, colour, lashes, bridal looks. These appear under “Our work”.</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {props.photos.map((p) => (
          <figure key={p.id} className="relative aspect-square overflow-hidden rounded-xl bg-brand-50">
            <Image src={photoUrl(p.storage_path)} alt={p.caption ?? ""} fill sizes="20vw" className="object-cover" />
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => removePhoto(props.listingId, props.slug, p.id))}
              className="absolute right-1 top-1 rounded-full bg-white/90 px-2"
              aria-label="Remove photo"
            >
              ✕
            </button>
            {p.caption && <figcaption className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1 text-xs text-white">{p.caption}</figcaption>}
          </figure>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <select aria-label="Service" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={input}>
          <option value="">Service (optional)</option>
          {props.categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name_en}</option>
          ))}
        </select>
        <input aria-label="Caption" value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={140} placeholder="Caption, e.g. chrome French tips" className={input} />
        <label className={`${ghostButton} cursor-pointer text-center`}>
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
              run(async () => {
                for (const file of files) {
                  const up = await uploadFile("listing-photos", props.listingId, file, 5 * 1024 * 1024);
                  if ("error" in up) return { error: up.error };
                  const r = await addPortfolioPhoto(props.listingId, props.slug, up.path, num(categoryId), caption);
                  if (r.error) return r;
                }
                setCaption("");
                return { message: files.length === 1 ? "Added." : `${files.length} photos added.` };
              });
            }}
          />
        </label>
      </div>
      <Status state={state} />
    </div>
  );
}

// ---------------------------------------------------------------------------

type StaffRow = { id: number | null; name: string; title: string; bio: string; photo_path: string | null; languages: string };

export function StaffEditor(props: {
  listingId: string;
  slug: string;
  initial: { id: number; name: string; title: string | null; bio: string | null; photo_path: string | null; languages: string[] }[];
}) {
  const [rows, setRows] = useState<StaffRow[]>(
    props.initial.map((s) => ({ ...s, title: s.title ?? "", bio: s.bio ?? "", languages: s.languages.join(", ") })),
  );
  const { state, pending, run } = useSaver();
  const set = (i: number, patch: Partial<StaffRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className={box}>
      <p className="text-muted">Customers can pick who they want when they book.</p>
      {rows.map((r, i) => (
        <div key={r.id ?? `new-${i}`} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[64px_1fr]">
          <label className="relative block h-16 w-16 cursor-pointer overflow-hidden rounded-full bg-brand-50" title="Photo">
            {r.photo_path ? (
              <Image src={photoUrl(r.photo_path)} alt="" fill sizes="64px" className="object-cover" />
            ) : (
              <>
                <Silhouette />
                <span className="absolute inset-x-0 bottom-0 bg-black/40 text-center text-[10px] text-white">Add photo</span>
              </>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                run(async () => {
                  const up = await uploadFile("listing-photos", props.listingId, file, 5 * 1024 * 1024);
                  if ("error" in up) return { error: up.error };
                  set(i, { photo_path: up.path });
                  return { message: "Photo ready. Save the team to keep it." };
                });
              }}
            />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <input aria-label="Name" value={r.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="Name" maxLength={60} className={input} />
            <input aria-label="Role" value={r.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="Role, e.g. Senior stylist" maxLength={60} className={input} />
            <input aria-label="Languages" value={r.languages} onChange={(e) => set(i, { languages: e.target.value })} placeholder="Languages, e.g. BM, English, 中文" className={input} />
            <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="justify-self-start text-muted underline">
              Remove
            </button>
            <textarea aria-label="About" value={r.bio} onChange={(e) => set(i, { bio: e.target.value })} placeholder="A line about them (optional)" maxLength={500} rows={2} className={`${input} sm:col-span-2`} />
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={ghostButton} onClick={() => setRows([...rows, { id: null, name: "", title: "", bio: "", photo_path: null, languages: "" }])}>
          Add person
        </button>
        <button
          disabled={pending}
          className={saveButton}
          onClick={() =>
            run(() =>
              saveStaff(
                props.listingId,
                props.slug,
                rows
                  .filter((r) => r.name.trim())
                  .map((r) => ({
                    ...r,
                    languages: r.languages.split(",").map((l) => l.trim()).filter(Boolean).slice(0, 6),
                  })),
              ),
            )
          }
        >
          Save team
        </button>
        <Status state={state} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function PromotionsEditor(props: { listingId: string; slug: string; promotions: Promotion[]; today: string }) {
  const { state, pending, run } = useSaver();
  const [form, setForm] = useState({ title: "", details: "", price_label: "", occasion: "other", starts_on: props.today, ends_on: "" });
  return (
    <div className={box}>
      {props.promotions.length > 0 && (
        <ul className="divide-y divide-line">
          {props.promotions.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 py-2">
              <span>
                <strong>{p.title}</strong> {p.price_label && `· ${p.price_label}`}
                <span className="block text-xs text-muted">
                  {OCCASION_LABELS[p.occasion]} · {formatDate(p.starts_on)} – {formatDate(p.ends_on)}
                  {p.ends_on < props.today ? " · ended" : ""}
                </span>
              </span>
              <button type="button" disabled={pending} onClick={() => run(() => removePromotion(props.listingId, props.slug, p.id))} className="text-muted underline">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="font-medium">New deal</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input aria-label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Raya glam makeup" maxLength={80} className={input} />
        <input aria-label="Price" value={form.price_label} onChange={(e) => setForm({ ...form, price_label: e.target.value })} placeholder="e.g. RM99 (was RM150) or 20% off" maxLength={40} className={input} />
        <select aria-label="Occasion" value={form.occasion} onChange={(e) => setForm({ ...form, occasion: e.target.value })} className={input}>
          {OCCASIONS.map((o) => (
            <option key={o} value={o}>{OCCASION_LABELS[o]}</option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input aria-label="Starts" type="date" value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} className={input} />
          <input aria-label="Ends" type="date" value={form.ends_on} min={form.starts_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} className={input} />
        </div>
        <textarea aria-label="Details" value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} placeholder="What's included, any conditions" maxLength={500} rows={2} className={`${input} sm:col-span-2`} />
      </div>
      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          className={saveButton}
          onClick={() =>
            run(async () => {
              const r = await addPromotion(props.listingId, props.slug, form);
              if (!r.error) setForm({ ...form, title: "", details: "", price_label: "", ends_on: "" });
              return r;
            })
          }
        >
          Add deal
        </button>
        <Status state={state} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

type PackageRow = { kind: string; name: string; description: string; includes: string; price_from: string; price_to: string };

export function PackagesEditor(props: { listingId: string; slug: string; initial: ServicePackage[] }) {
  const [rows, setRows] = useState<PackageRow[]>(
    props.initial.map((p) => ({
      kind: p.kind,
      name: p.name,
      description: p.description ?? "",
      includes: p.includes.join("\n"),
      price_from: p.price_from?.toString() ?? "",
      price_to: p.price_to?.toString() ?? "",
    })),
  );
  const { state, pending, run } = useSaver();
  const set = (i: number, patch: Partial<PackageRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className={box}>
      <p className="text-muted">Bridal, engagement, dinner or group packages. Customers can ask you for a quote on WhatsApp.</p>
      {rows.map((r, i) => (
        <div key={i} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-2">
          <select aria-label="Type" value={r.kind} onChange={(e) => set(i, { kind: e.target.value })} className={input}>
            {PACKAGE_KINDS.map((k) => (
              <option key={k} value={k}>{PACKAGE_KIND_LABELS[k]}</option>
            ))}
          </select>
          <input aria-label="Name" value={r.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="e.g. Nikah + sanding package" maxLength={80} className={input} />
          <input aria-label="Price from (RM)" value={r.price_from} onChange={(e) => set(i, { price_from: e.target.value })} inputMode="decimal" placeholder="RM from" className={input} />
          <input aria-label="Price to (RM)" value={r.price_to} onChange={(e) => set(i, { price_to: e.target.value })} inputMode="decimal" placeholder="RM to (optional)" className={input} />
          <textarea aria-label="Description" value={r.description} onChange={(e) => set(i, { description: e.target.value })} placeholder="Description" maxLength={1000} rows={2} className={input} />
          <textarea aria-label="What's included" value={r.includes} onChange={(e) => set(i, { includes: e.target.value })} placeholder={"What's included, one per line\nTrial makeup\nHijab styling"} rows={3} className={input} />
          <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="justify-self-start text-muted underline">
            Remove
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={ghostButton} onClick={() => setRows([...rows, { kind: "bridal", name: "", description: "", includes: "", price_from: "", price_to: "" }])}>
          Add package
        </button>
        <button
          disabled={pending}
          className={saveButton}
          onClick={() =>
            run(async () => {
              const payload = rows
                .filter((r) => r.name.trim())
                .map((r) => ({
                  kind: r.kind,
                  name: r.name.trim(),
                  description: r.description.trim(),
                  includes: r.includes.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 15),
                  price_from: num(r.price_from),
                  price_to: num(r.price_to),
                }));
              if (payload.some((p) => [p.price_from, p.price_to].some((n) => n !== null && Number.isNaN(n)))) {
                return { error: "Prices must be numbers." };
              }
              return savePackages(props.listingId, props.slug, payload);
            })
          }
        >
          Save packages
        </button>
        <Status state={state} />
      </div>
    </div>
  );
}

export function QuoteStatusButtons({ listingId, id, status }: { listingId: string; id: string; status: string }) {
  const [pending, start] = useTransition();
  const next: Record<string, { status: "quoted" | "booked" | "declined"; label: string }[]> = {
    sent: [
      { status: "quoted", label: "Quote sent" },
      { status: "declined", label: "Decline" },
    ],
    quoted: [
      { status: "booked", label: "Booked" },
      { status: "declined", label: "Didn't book" },
    ],
  };
  return (
    <div className="flex gap-2">
      {(next[status] ?? []).map((a, i) => (
        <button
          key={a.status}
          disabled={pending}
          onClick={() => start(() => setQuoteStatus(listingId, id, a.status))}
          className={`rounded-full px-3 py-1 text-sm disabled:opacity-50 ${i === 0 ? "bg-ink text-white" : "border border-line bg-white"}`}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function BookingSettingsForm(props: { listingId: string; slug: string; initial: BookingSettings | null; hasHours: boolean }) {
  const [s, setS] = useState<BookingSettings>(
    props.initial ?? { instant_enabled: false, slot_minutes: 30, capacity: 1, min_notice_hours: 2, max_days_ahead: 14 },
  );
  const { state, pending, run } = useSaver();
  const field = (label: string, key: keyof BookingSettings, options: number[], suffix: string) => (
    <label className="block">
      <span className="font-medium">{label}</span>
      <select value={Number(s[key])} onChange={(e) => setS({ ...s, [key]: Number(e.target.value) })} className={`mt-1 ${input}`}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o} {suffix}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className={box}>
      <label className="flex items-start gap-3">
        <input type="checkbox" className="mt-1" checked={s.instant_enabled} onChange={(e) => setS({ ...s, instant_enabled: e.target.checked })} />
        <span>
          <span className="font-medium">Let customers book free slots instantly</span>
          <span className="block text-muted">
            Customers see only the times you have space and their booking is confirmed straight away. They can still
            WhatsApp you. Leave it off to keep confirming each request yourself.
          </span>
        </span>
      </label>
      {!props.hasHours && <p className="text-brand-700">Add your opening hours first.</p>}
      <div className="grid gap-3 sm:grid-cols-4">
        {field("Slot length", "slot_minutes", [15, 30, 45, 60, 90, 120], "min")}
        {field("Customers at once", "capacity", [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20], "")}
        {field("Notice needed", "min_notice_hours", [0, 1, 2, 3, 6, 12, 24, 48], "hours")}
        {field("Book ahead up to", "max_days_ahead", [7, 14, 21, 30, 60], "days")}
      </div>
      <p className="text-xs text-muted">“Customers at once” is how many chairs or beds you can fill in the same slot.</p>
      <div className="flex items-center gap-3">
        <button disabled={pending} className={saveButton} onClick={() => run(() => saveBookingSettings(props.listingId, props.slug, s))}>
          Save booking settings
        </button>
        <Status state={state} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function ReviewReply(props: { listingId: string; reviewId: number; reply: string | null }) {
  const [text, setText] = useState(props.reply ?? "");
  const { state, pending, run } = useSaver();
  return (
    <div className="mt-2 space-y-2">
      <textarea aria-label="Your public reply" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} rows={2} placeholder="Reply publicly (optional)" className={input} />
      <div className="flex items-center gap-3">
        <button disabled={pending} className={saveButton} onClick={() => run(() => replyToReview(props.listingId, props.reviewId, text))}>
          {props.reply ? "Update reply" : "Reply"}
        </button>
        <Status state={state} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function LoyaltyEditor(props: { listingId: string; slug: string; initial: LoyaltyProgram | null }) {
  const [p, setP] = useState<LoyaltyProgram>(props.initial ?? { enabled: false, stamps_required: 8, reward: "" });
  const { state, pending, run } = useSaver();
  const card = useSaver();
  const [code, setCode] = useState("");
  const [found, setFound] = useState<CardLookup["customer"] | null>(null);
  return (
    <div className={box}>
      <label className="flex items-start gap-3">
        <input type="checkbox" className="mt-1" checked={p.enabled} onChange={(e) => setP({ ...p, enabled: e.target.checked })} />
        <span>
          <span className="font-medium">Run a stamp card</span>
          <span className="block text-muted">
            Customers signed in to BeautyBook get a stamp each time you mark their booking “Completed”.
          </span>
        </span>
      </label>
      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <label className="block">
          <span className="font-medium">Stamps for a reward</span>
          <input type="number" min={2} max={20} value={p.stamps_required} onChange={(e) => setP({ ...p, stamps_required: Number(e.target.value) })} className={`mt-1 ${input}`} />
        </label>
        <label className="block">
          <span className="font-medium">Reward</span>
          <input value={p.reward} onChange={(e) => setP({ ...p, reward: e.target.value })} maxLength={80} placeholder="e.g. Free haircut, or RM20 off" className={`mt-1 ${input}`} />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button disabled={pending} className={saveButton} onClick={() => run(() => saveLoyalty(props.listingId, props.slug, p))}>
          Save stamp card
        </button>
        <Status state={state} />
      </div>
      {props.initial?.enabled && (
        <div className="space-y-2 border-t border-line pt-3">
          <p className="font-medium">Give a reward</p>
          <p className="text-muted">Ask for the code on the customer&apos;s card (My account → Stamp cards).</p>
          <div className="flex gap-2">
            <input aria-label="Customer code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={8} placeholder="8-letter code" className={`${input} max-w-40 uppercase`} />
            <button
              disabled={card.pending}
              className={ghostButton}
              onClick={() =>
                card.run(async () => {
                  const r = await lookupCard(props.listingId, code);
                  setFound(r.customer ?? null);
                  return r.error ? r : { message: undefined };
                })
              }
            >
              Look up
            </button>
          </div>
          {found && (
            <p className="flex flex-wrap items-center gap-3">
              {found.name}: <strong>{found.stamps}</strong> of {p.stamps_required} stamps
              {found.stamps >= props.initial.stamps_required && (
                <button
                  disabled={card.pending}
                  className={saveButton}
                  onClick={() =>
                    card.run(async () => {
                      const r = await redeemLoyalty(props.listingId, found.userId);
                      if (!r.error) setFound({ ...found, stamps: found.stamps - props.initial!.stamps_required });
                      return r;
                    })
                  }
                >
                  Give {props.initial.reward}
                </button>
              )}
            </p>
          )}
          <Status state={card.state} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function VoucherEditor(props: {
  listingId: string;
  slug: string;
  initial: VoucherSettings | null;
  paymentsReady: boolean;
}) {
  const [v, setV] = useState({
    enabled: props.initial?.enabled ?? false,
    amounts: (props.initial?.amounts ?? [50, 100, 200]).join(", "),
    valid_months: props.initial?.valid_months ?? 6,
    terms: props.initial?.terms ?? "",
  });
  const { state, pending, run } = useSaver();
  const redeem = useSaver();
  const [code, setCode] = useState("");
  return (
    <div className={box}>
      {!props.paymentsReady && (
        <p className="rounded-xl bg-canvas p-3 text-muted">
          Gift voucher sales open once BeautyBook switches on online payments. You can set yours up now.
        </p>
      )}
      <label className="flex items-start gap-3">
        <input type="checkbox" className="mt-1" checked={v.enabled} onChange={(e) => setV({ ...v, enabled: e.target.checked })} />
        <span>
          <span className="font-medium">Sell gift vouchers</span>
          <span className="block text-muted">Customers pay BeautyBook online; we pay you out for each voucher used.</span>
        </span>
      </label>
      <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
        <label className="block">
          <span className="font-medium">Amounts (RM)</span>
          <input value={v.amounts} onChange={(e) => setV({ ...v, amounts: e.target.value })} placeholder="50, 100, 200" className={`mt-1 ${input}`} />
        </label>
        <label className="block">
          <span className="font-medium">Valid for</span>
          <select value={v.valid_months} onChange={(e) => setV({ ...v, valid_months: Number(e.target.value) })} className={`mt-1 ${input}`}>
            {[3, 6, 12, 24].map((m) => (
              <option key={m} value={m}>{m} months</option>
            ))}
          </select>
        </label>
      </div>
      <textarea aria-label="Terms" value={v.terms} onChange={(e) => setV({ ...v, terms: e.target.value })} maxLength={500} rows={2} placeholder="Terms (optional), e.g. not valid on public holidays" className={input} />
      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          className={saveButton}
          onClick={() =>
            run(() =>
              saveVoucherSettings(props.listingId, props.slug, {
                ...v,
                amounts: v.amounts.split(/[,\s]+/).filter(Boolean).map(Number),
              }),
            )
          }
        >
          Save vouchers
        </button>
        <Status state={state} />
      </div>
      <div className="space-y-2 border-t border-line pt-3">
        <p className="font-medium">Use a voucher</p>
        <div className="flex gap-2">
          <input aria-label="Voucher code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={12} placeholder="Voucher code" className={`${input} max-w-48 uppercase`} />
          <button disabled={redeem.pending} className={ghostButton} onClick={() => redeem.run(() => redeemVoucher(props.listingId, code))}>
            Use voucher
          </button>
        </div>
        <Status state={redeem.state} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function FeaturedRequest(props: {
  listingId: string;
  areas: Area[];
  categories: Category[];
  defaultAreaId: number | null;
  priceRm: number;
  paymentsReady: boolean;
}) {
  const [areaId, setAreaId] = useState(props.defaultAreaId ? String(props.defaultAreaId) : "");
  const [categoryId, setCategoryId] = useState("");
  const [note, setNote] = useState("");
  const { state, pending, run } = useSaver();
  return (
    <div className={box}>
      <p>
        Show at the top of search and area pages with a <strong>Featured</strong> badge for 30 days, for{" "}
        <strong>RM{props.priceRm}</strong>.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <select aria-label="Area" value={areaId} onChange={(e) => setAreaId(e.target.value)} className={input}>
          <option value="">All of Klang Valley</option>
          {props.areas.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <select aria-label="Service" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={input}>
          <option value="">All services</option>
          {props.categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name_en}</option>
          ))}
        </select>
      </div>
      {!props.paymentsReady && (
        <input aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Anything we should know? (optional)" className={input} />
      )}
      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          className={saveButton}
          onClick={() => run(() => requestFeatured(props.listingId, { areaId: num(areaId), categoryId: num(categoryId), note }))}
        >
          {props.paymentsReady ? `Pay RM${props.priceRm} and go live` : "Request featured placement"}
        </button>
        <Status state={state} />
      </div>
    </div>
  );
}
