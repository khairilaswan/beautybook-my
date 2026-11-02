"use server";

import { updateTag } from "next/cache";
import { revalidateLocalized } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type ActionState } from "@/app/[lang]/admin/actions";
import { type Permission, requirePermission } from "@/lib/auth";
import { GUIDES_TAG } from "@/lib/data/content";
import { tags } from "@/lib/data/directory";
import { FEATURES_TAG } from "@/lib/data/features";
import { slugify } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";

async function staffClient(perm: Permission) {
  const { user } = await requirePermission(perm);
  return { user, supabase: await createClient() };
}

// ---------------------------------------------------------------------------
// Site switches (/admin/features)
// ---------------------------------------------------------------------------

const featureSchema = z.object({
  reviews_enabled: z.boolean(),
  referral_points: z.number().int().min(0).max(10000),
  featured_price_rm: z.number().int().min(1).max(100000),
});

export async function saveFeatureSettings(input: unknown): Promise<ActionState> {
  const { user, supabase } = await staffClient("staff.manage");
  const parsed = featureSchema.safeParse(input);
  if (!parsed.success) return { error: "Please check the numbers." };
  const { data, error } = await supabase
    .from("site_settings")
    .update({ ...parsed.data, updated_by: user.id, updated_at: new Date().toISOString() })
    .eq("id", true)
    .select("id");
  if (error || !data?.length) return { error: "Could not save. Has the 2026-11-02 SQL been run?" };
  updateTag(FEATURES_TAG);
  updateTag(tags.listings);
  revalidateLocalized("/admin/features");
  return { message: "Saved." };
}

// ---------------------------------------------------------------------------
// Featured placements (/admin/featured)
// ---------------------------------------------------------------------------

const grantSchema = z.object({
  listingSlug: z.string().trim().min(1, "Which shop?"),
  areaId: z.coerce.number().int().positive().optional().or(z.literal("")),
  categoryId: z.coerce.number().int().positive().optional().or(z.literal("")),
  days: z.coerce.number().int().min(1).max(365),
});

export async function grantFeatured(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { user, supabase } = await staffClient("billing.manage");
  const parsed = grantSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const slug = parsed.data.listingSlug.replace(/^.*\/salon\//, "").replace(/[/?#].*$/, "");
  const { data: listing } = await supabase.from("listings").select("id").eq("slug", slug).maybeSingle();
  if (!listing) return { error: "No shop has that link or slug." };
  const now = Date.now();
  const { error } = await supabase.from("featured_placements").insert({
    listing_id: listing.id,
    area_id: parsed.data.areaId || null,
    category_id: parsed.data.categoryId || null,
    starts_at: new Date(now).toISOString(),
    ends_at: new Date(now + parsed.data.days * 86_400_000).toISOString(),
    status: "active",
    requested_by: user.id,
  });
  if (error) return { error: "Could not save." };
  updateTag(tags.listings);
  revalidateLocalized("/admin/featured");
  return { message: "Featured." };
}

export async function setFeaturedStatus(id: number, status: "active" | "cancelled", days = 30): Promise<void> {
  const { supabase } = await staffClient("billing.manage");
  const now = Date.now();
  await supabase
    .from("featured_placements")
    .update(
      status === "active"
        ? { status, starts_at: new Date(now).toISOString(), ends_at: new Date(now + days * 86_400_000).toISOString() }
        : { status },
    )
    .eq("id", id);
  updateTag(tags.listings);
  revalidateLocalized("/admin/featured");
}

// ---------------------------------------------------------------------------
// Guides (/admin/guides)
// ---------------------------------------------------------------------------

const guideSchema = z.object({
  id: z.coerce.number().int().positive().optional().or(z.literal("")),
  title: z.string().trim().min(1, "Add a title").max(120),
  slug: z.string().trim().max(100).optional(),
  summary: z.string().trim().max(300),
  body: z.string().max(50000),
  areaId: z.coerce.number().int().positive().optional().or(z.literal("")),
  categoryId: z.coerce.number().int().positive().optional().or(z.literal("")),
  faqs: z.string().max(10000),
  status: z.enum(["draft", "published"]),
});

// FAQs are typed as "Q: question" then "A: answer" lines.
function parseFaqs(text: string): { question: string; answer: string }[] {
  const out: { question: string; answer: string }[] = [];
  let q: string | null = null;
  for (const line of text.split("\n").map((l) => l.trim()).filter(Boolean)) {
    if (/^q:/i.test(line)) q = line.slice(2).trim();
    else if (/^a:/i.test(line) && q) {
      out.push({ question: q, answer: line.slice(2).trim() });
      q = null;
    } else if (out.length && !q) out[out.length - 1].answer += ` ${line}`;
  }
  return out.slice(0, 20);
}

export async function saveGuide(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { user, supabase } = await staffClient("seo.edit");
  const parsed = guideSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the guide." };
  const g = parsed.data;
  const slug = slugify(g.slug || g.title).slice(0, 100);
  if (!slug) return { error: "The link needs letters or numbers." };
  const row = {
    title: g.title,
    slug,
    summary: g.summary || null,
    body: g.body,
    area_id: g.areaId || null,
    category_id: g.categoryId || null,
    faqs: parseFaqs(g.faqs),
    status: g.status,
  };
  let id = g.id || null;
  if (id) {
    const { data: before } = await supabase.from("guides").select("published_at").eq("id", id).single();
    const { error } = await supabase
      .from("guides")
      .update({ ...row, published_at: g.status === "published" ? (before?.published_at ?? new Date().toISOString()) : before?.published_at })
      .eq("id", id);
    if (error) return { error: error.code === "23505" ? "Another guide already uses that link." : "Could not save." };
  } else {
    const { data, error } = await supabase
      .from("guides")
      .insert({ ...row, author_id: user.id, published_at: g.status === "published" ? new Date().toISOString() : null })
      .select("id")
      .single();
    if (error) return { error: error.code === "23505" ? "Another guide already uses that link." : "Could not save." };
    id = data.id;
  }
  updateTag(GUIDES_TAG);
  revalidateLocalized("/admin/guides");
  if (!g.id) redirect(`/admin/guides/${id}?saved=1`);
  return { message: g.status === "published" ? "Saved and live." : "Draft saved." };
}

export async function deleteGuide(id: number): Promise<void> {
  const { supabase } = await staffClient("seo.edit");
  await supabase.from("guides").delete().eq("id", id);
  updateTag(GUIDES_TAG);
  revalidateLocalized("/admin/guides");
  redirect("/admin/guides");
}
