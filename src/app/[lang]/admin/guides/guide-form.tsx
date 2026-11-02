"use client";

import { useActionState, useTransition } from "react";
import type { ActionState } from "@/app/[lang]/admin/actions";
import { deleteGuide, saveGuide } from "@/app/[lang]/admin/growth-actions";
import type { Area, Category } from "@/lib/types";

const input = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";

type Guide = {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  body: string;
  area_id: number | null;
  category_id: number | null;
  faqs: { question: string; answer: string }[];
  status: string;
};

const BODY_HINT = `## Why go to Bangsar for nails

Write in short paragraphs. Use **bold**, *italics*, [links](/bangsar/nails) and lists:

- Gel manicure: what to expect
- How long it lasts`;

export function GuideForm({ areas, categories, guide }: { areas: Area[]; categories: Category[]; guide: Guide | null }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveGuide, {});
  const [deleting, startDelete] = useTransition();
  return (
    <form action={action} className="mt-4 space-y-4 rounded-2xl border border-line bg-white p-5 text-sm">
      {guide && <input type="hidden" name="id" value={guide.id} />}
      <label className="block">
        <span className="font-medium">Title</span>
        <input name="title" required maxLength={120} defaultValue={guide?.title} placeholder="Best nail salons in Bangsar (2026)" className={input} />
      </label>
      <label className="block">
        <span className="font-medium">Link</span>
        <input name="slug" maxLength={100} defaultValue={guide?.slug} placeholder="made from the title if left empty" className={input} />
      </label>
      <label className="block">
        <span className="font-medium">Summary</span>
        <textarea name="summary" maxLength={300} rows={2} defaultValue={guide?.summary ?? ""} placeholder="One or two sentences. Shown in Google and AI answers." className={input} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="font-medium">Area (lists its shops)</span>
          <select name="areaId" defaultValue={guide?.area_id ?? ""} className={input}>
            <option value="">None</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="font-medium">Service</span>
          <select name="categoryId" defaultValue={guide?.category_id ?? ""} className={input}>
            <option value="">None</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name_en}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="font-medium">Article</span>
        <textarea name="body" rows={18} maxLength={50000} defaultValue={guide?.body ?? ""} placeholder={BODY_HINT} className={`${input} font-mono`} />
      </label>
      <label className="block">
        <span className="font-medium">Questions and answers</span>
        <textarea
          name="faqs"
          rows={6}
          defaultValue={guide?.faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n") ?? ""}
          placeholder={"Q: How much is a gel manicure in Bangsar?\nA: Usually RM60 to RM120…"}
          className={`${input} font-mono`}
        />
        <span className="text-xs text-muted">Shown at the end and marked up for Google&apos;s FAQ answers.</span>
      </label>
      <label className="block">
        <span className="font-medium">Status</span>
        <select name="status" defaultValue={guide?.status ?? "draft"} className={input}>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="rounded-full bg-ink px-4 py-2 font-medium text-white disabled:opacity-60">Save</button>
        {guide && (
          <button
            type="button"
            disabled={deleting}
            onClick={() => startDelete(() => deleteGuide(guide.id))}
            className="rounded-full border border-line px-4 py-2"
          >
            Delete
          </button>
        )}
        {state.error && <span role="alert" className="text-brand-700">{state.error}</span>}
        {state.message && <span className="text-whatsapp">{state.message}</span>}
      </div>
    </form>
  );
}
