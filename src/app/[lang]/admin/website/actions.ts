"use server";
import { revalidatePath, updateTag } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { WEBSITE_TAG } from "@/lib/data/website-settings";
import { heroSlideSchema, websiteSchema } from "@/lib/website-settings";
import type { ActionState } from "../actions";

export async function saveWebsite(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { user } = await requirePermission("staff.manage");
  const db = await createClient();
  const { data: row, error: readError } = await db
    .from("site_settings")
    .select("website, updated_at")
    .eq("id", true)
    .single();
  if (readError || !row)
    return {
      error:
        "Website settings are unavailable. Apply the website settings migration first.",
    };
  const before = websiteSchema.safeParse(row.website);
  if (!before.success)
    return { error: "Could not read existing website settings." };
  const input = { ...before.data };
  const submittedSlides = parseHeroSlides(form.get("heroSlides"));
  if (!submittedSlides)
    return { error: "Check the hero slides. You can add up to 10 images." };
  const oldSlides = before.data.heroSlides.length
    ? before.data.heroSlides
    : before.data.heroImage
      ? [{ id: "legacy-hero", image: before.data.heroImage, alt: before.data.heroAlt }]
      : [];
  const oldImages = new Set(oldSlides.map((slide) => slide.image));
  input.heroSlides = submittedSlides.map((slide) => ({
    ...slide,
    image: oldImages.has(slide.image) ? slide.image : "",
  }));
  input.heroInterval = Number(form.get("heroInterval") ?? input.heroInterval);
  for (const key of [
    "name",
    "heroAlt",
    "businessAlt",
    "googleVerification",
  ] as const)
    input[key] = String(form.get(key) ?? "");
  input.indexing = form.get("indexing") === "on";
  for (const locale of ["en", "ms", "zh"] as const) {
    input[locale] = { ...input[locale] };
    for (const key of [
      "title",
      "description",
      "heroTitle",
      "heroLead",
    ] as const)
      input[locale][key] = String(form.get(`${locale}.${key}`) ?? "");
  }
  const parsed = websiteSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Check the settings." };
  const next = parsed.data;
  const { data: categories } = await db.from("categories").select("slug");
  const slots = [
    "logo",
    "favicon",
    "socialImage",
    "heroImage",
    "businessImage",
    ...(categories ?? []).map((c) => `category:${c.slug}`),
    ...input.heroSlides.map((slide) => `heroSlide:${slide.id}`),
  ];
  const files: { slot: string; file: File; ext: string }[] = [];
  let total = 0;
  for (const slot of slots) {
    const file = form.get(`file:${slot}`);
    if (!(file instanceof File) || file.size === 0) continue;
    total += file.size;
    if (file.size > 2 * 1024 * 1024 || total > 12 * 1024 * 1024)
      return { error: "Images must be under 2 MB each and 12 MB per save." };
    const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const ext =
      b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71
        ? "png"
        : b[0] === 255 && b[1] === 216 && b[2] === 255
          ? "jpg"
          : String.fromCharCode(...b.slice(0, 4)) === "RIFF" &&
              String.fromCharCode(...b.slice(8, 12)) === "WEBP"
            ? "webp"
            : slot === "favicon" &&
                b[0] === 0 &&
                b[1] === 0 &&
                b[2] === 1 &&
                b[3] === 0
              ? "ico"
              : "";
    if (!ext)
      return {
        error: `Use PNG, JPEG or WebP images (${slot}). Favicons also support ICO.`,
      };
    files.push({ slot, file, ext });
  }
  const uploaded: string[] = [];
  const setImage = (slot: string, url: string) => {
    if (slot.startsWith("category:")) next.categoryImages[slot.slice(9)] = url;
    else if (slot.startsWith("heroSlide:")) {
      const slide = next.heroSlides.find((item) => item.id === slot.slice(10));
      if (slide) slide.image = url;
    }
    else
      next[
        slot as
          "logo" | "favicon" | "socialImage" | "heroImage" | "businessImage"
      ] = url;
  };
  for (const slot of slots)
    if (form.get(`remove:${slot}`) === "on") setImage(slot, "");
  for (const { slot, file, ext } of files) {
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await db.storage
      .from("site-media")
      .upload(path, file, {
        contentType:
          ext === "ico"
            ? "image/x-icon"
            : `image/${ext === "jpg" ? "jpeg" : ext}`,
        upsert: false,
      });
    if (error) {
      if (uploaded.length) await db.storage.from("site-media").remove(uploaded);
      return {
        error:
          "Image upload failed. Your previous settings are unchanged. Try again.",
      };
    }
    uploaded.push(path);
    setImage(
      slot,
      db.storage.from("site-media").getPublicUrl(path).data.publicUrl,
    );
  }
  next.heroSlides = next.heroSlides.filter((slide) => slide.image);
  next.heroImage = next.heroSlides[0]?.image ?? "";
  next.heroAlt = next.heroSlides[0]?.alt ?? "";
  const { data, error } = await db
    .from("site_settings")
    .update({
      website: next,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true)
    .eq("updated_at", row.updated_at)
    .select("id");
  if (error || !data?.length) {
    if (uploaded.length) await db.storage.from("site-media").remove(uploaded);
    return {
      error:
        "Could not save, or another administrator saved first. Reload and try again.",
    };
  }
  updateTag(WEBSITE_TAG);
  revalidatePath("/", "layout");
  revalidatePath("/sitemap.xml");
  revalidatePath("/robots.txt");
  return { message: "Website settings saved." };
}

function parseHeroSlides(value: FormDataEntryValue | null) {
  try {
    const result = heroSlideSchema.array().max(10).safeParse(JSON.parse(String(value ?? "[]")));
    if (!result.success || new Set(result.data.map((slide) => slide.id)).size !== result.data.length)
      return null;
    return result.data;
  } catch {
    return null;
  }
}

export async function refreshSitemap(): Promise<ActionState> {
  await requirePermission("staff.manage");
  revalidatePath("/sitemap.xml");
  revalidatePath("/robots.txt");
  return {
    message:
      "Sitemap refreshed. It is generated from published content when opened.",
  };
}
