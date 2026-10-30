"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type Permission, requirePermission } from "@/lib/auth";
import { tags } from "@/lib/data/directory";
import { type CleanListing, type ImportRow, MAX_IMPORT_ROWS, cleanRow, normalizeName } from "@/lib/import";
import { normalizeMalaysianPhone } from "@/lib/phone";
import { listingSlug, slugify, uniqueSlug } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Every action re-checks the permission; RLS enforces the same rules again in
// the database, and the audit log records who did what.
async function staffClient(perm: Permission) {
  const { user } = await requirePermission(perm);
  return { user, supabase: await createClient() };
}

function refreshListing(slug?: string) {
  if (slug) updateTag(tags.listing(slug));
  updateTag(tags.listings);
  revalidatePath("/admin", "layout");
}

export type ActionState = { error?: string; message?: string };

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

const listingSchema = z.object({
  id: z.uuid().optional().or(z.literal("")),
  name: z.string().trim().min(1, "Name is required").max(160),
  slug: z.string().trim().max(120).optional(),
  status: z.enum(["active", "closed", "hidden", "archived"]),
  area: z.string().min(1, "Choose an area"),
  category: z.string().min(1, "Choose a main category"),
  address: z.string().trim().max(300).optional(),
  postcode: z.string().trim().regex(/^(\d{5})?$/, "Postcode should be 5 digits").optional(),
  lat: z.string().trim().optional(),
  lng: z.string().trim().optional(),
  phone: z.string().trim().max(20).optional(),
  whatsapp: z.string().trim().max(20).optional(),
  website: z.string().trim().max(300).optional(),
  instagram: z.string().trim().max(300).optional(),
  facebook: z.string().trim().max(300).optional(),
  description: z.string().trim().max(2000).optional(),
  priceLevel: z.enum(["", "1", "2", "3", "4"]).optional(),
  gender: z.enum(["", "men", "women", "unisex"]).optional(),
  googlePlaceId: z.string().trim().max(300).optional(),
});

export async function saveListing(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { user, supabase } = await staffClient("listings.edit");
  const parsed = listingSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const d = parsed.data;

  const phone = d.phone ? normalizeMalaysianPhone(d.phone) : null;
  const whatsapp = d.whatsapp ? normalizeMalaysianPhone(d.whatsapp) : null;
  if (d.phone && !phone) return { error: "Phone is not a Malaysian number." };
  if (d.whatsapp && !whatsapp) return { error: "WhatsApp is not a Malaysian number." };
  const lat = d.lat ? Number(d.lat) : null;
  const lng = d.lng ? Number(d.lng) : null;
  if ((lat !== null && !Number.isFinite(lat)) || (lng !== null && !Number.isFinite(lng))) {
    return { error: "Latitude and longitude must be numbers." };
  }

  const [{ data: area }, { data: categories }] = await Promise.all([
    supabase.from("areas").select("id, slug").eq("slug", d.area).single(),
    supabase.from("categories").select("id, slug").in("slug", [d.category, ...form.getAll("otherCategories").map(String)]),
  ]);
  if (!area) return { error: "Unknown area." };
  const primary = categories?.find((c) => c.slug === d.category);
  if (!primary) return { error: "Unknown category." };

  const existing = d.id
    ? (await supabase.from("listings").select("id, slug").eq("id", d.id).single()).data
    : null;
  const wanted = slugify(d.slug || "") || listingSlug(d.name, area.slug);
  const slug =
    existing?.slug === wanted
      ? wanted
      : await uniqueSlug(wanted, async (candidates) => {
          const { data } = await supabase.from("listings").select("slug").in("slug", candidates);
          return (data ?? []).map((r) => r.slug);
        });

  const values = {
    name: d.name,
    slug,
    status: d.status,
    area_id: area.id,
    address: d.address || null,
    postcode: d.postcode || null,
    lat,
    lng,
    phone,
    whatsapp,
    website: d.website || null,
    instagram: d.instagram || null,
    facebook: d.facebook || null,
    description: d.description || null,
    price_level: d.priceLevel ? Number(d.priceLevel) : null,
    gender: d.gender || null,
    google_place_id: d.googlePlaceId || null,
  };

  let id = existing?.id;
  if (existing) {
    const { error } = await supabase.from("listings").update(values).eq("id", existing.id);
    if (error) return { error: error.code === "23505" ? "Another listing already has that Google place ID." : "Could not save." };
    if (existing.slug !== slug) {
      await supabase.from("redirects").upsert({ from_path: `/shop/${existing.slug}`, to_path: `/shop/${slug}` });
    }
  } else {
    const { data, error } = await supabase
      .from("listings")
      .insert({ ...values, source: "manual", created_by: user.id, last_verified_at: new Date().toISOString() })
      .select("id")
      .single();
    if (error) return { error: error.code === "23505" ? "Another listing already has that Google place ID." : "Could not save." };
    id = data.id;
  }

  // Categories and attributes are replaced as a whole.
  await supabase.from("listing_categories").delete().eq("listing_id", id!);
  await supabase.from("listing_categories").insert(
    (categories ?? []).map((c) => ({ listing_id: id!, category_id: c.id, is_primary: c.id === primary.id })),
  );
  const attrs = form.getAll("attributes").map(Number).filter(Number.isInteger);
  await supabase.from("listing_attributes").delete().eq("listing_id", id!);
  if (attrs.length) {
    await supabase.from("listing_attributes").insert(attrs.map((attribute_id) => ({ listing_id: id!, attribute_id })));
  }

  refreshListing(slug);
  if (existing?.slug && existing.slug !== slug) refreshListing(existing.slug);
  if (!existing) redirect(`/admin/listings/${id}?created=1`);
  return { message: "Saved." };
}

export async function setListingStatus(id: string, status: "active" | "archived" | "hidden" | "closed") {
  const { supabase } = await staffClient("listings.edit");
  const { data } = await supabase.from("listings").update({ status }).eq("id", id).select("slug").single();
  refreshListing(data?.slug);
}

export async function markVerified(id: string) {
  const { supabase } = await staffClient("listings.edit");
  const { data } = await supabase
    .from("listings")
    .update({ last_verified_at: new Date().toISOString() })
    .eq("id", id)
    .select("slug")
    .single();
  refreshListing(data?.slug);
}

// Merges a duplicate into the listing we keep: requests, favourites and
// members move over, the duplicate is archived and its URL redirects.
export async function mergeListings(keepId: string, duplicateSlug: string): Promise<ActionState> {
  await requirePermission("listings.edit");
  const admin = createAdminClient();
  const [{ data: keep }, { data: dup }] = await Promise.all([
    admin.from("listings").select("id, slug").eq("id", keepId).single(),
    admin.from("listings").select("id, slug").eq("slug", duplicateSlug.trim()).maybeSingle(),
  ]);
  if (!keep || !dup || keep.id === dup.id) return { error: "Enter the slug of a different listing." };
  await admin.from("booking_requests").update({ listing_id: keep.id }).eq("listing_id", dup.id);
  for (const table of ["favourites", "notes", "listing_members"] as const) {
    const { data: rows } = await admin.from(table).select("*").eq("listing_id", dup.id);
    if (rows?.length) {
      await admin.from(table).upsert(rows.map((r) => ({ ...r, listing_id: keep.id })), { ignoreDuplicates: true });
      await admin.from(table).delete().eq("listing_id", dup.id);
    }
  }
  await admin.from("listings").update({ status: "archived" }).eq("id", dup.id);
  await admin.from("redirects").upsert({ from_path: `/shop/${dup.slug}`, to_path: `/shop/${keep.slug}` });
  refreshListing(keep.slug);
  refreshListing(dup.slug);
  return { message: `Merged ${dup.slug} into this listing.` };
}

// ---------------------------------------------------------------------------
// Bulk import
// ---------------------------------------------------------------------------

export type PreviewRow = {
  line: number;
  name: string;
  action: "create" | "update" | "error";
  matchSlug?: string;
  errors: string[];
  warnings: string[];
};

type Resolved = {
  value: CleanListing;
  line: number;
  existing: { id: string; slug: string } | null;
};

async function resolveRows(rows: ImportRow[]) {
  const supabase = await createClient();
  const [areas, categories, attributes] = await Promise.all([
    supabase.from("areas").select("id, slug"),
    supabase.from("categories").select("id, slug"),
    supabase.from("attributes").select("id, slug"),
  ]);
  const areaBySlug = new Map((areas.data ?? []).map((a) => [a.slug, a.id]));
  const catBySlug = new Map((categories.data ?? []).map((c) => [c.slug, c.id]));
  const attrBySlug = new Map((attributes.data ?? []).map((a) => [a.slug, a.id]));

  const cleaned = rows.map((row, i) => ({ line: i + 2, ...cleanRow(row) }));
  const valid = cleaned.filter((r) => r.value).map((r) => r.value!);
  const slugs = valid.map((v) => v.slug).filter(Boolean) as string[];
  const placeIds = valid.map((v) => v.google_place_id).filter(Boolean) as string[];
  const phones = valid.map((v) => v.phone).filter(Boolean) as string[];
  const areaIds = [...new Set(valid.map((v) => areaBySlug.get(v.area)).filter(Boolean))] as number[];

  const [bySlug, byPlace, byPhone, inAreas] = await Promise.all([
    slugs.length ? supabase.from("listings").select("id, slug").in("slug", slugs) : { data: [] },
    placeIds.length ? supabase.from("listings").select("id, slug, google_place_id").in("google_place_id", placeIds) : { data: [] },
    phones.length ? supabase.from("listings").select("id, slug, phone").in("phone", phones) : { data: [] },
    areaIds.length ? supabase.from("listings").select("id, slug, name, area_id").in("area_id", areaIds).neq("status", "archived") : { data: [] },
  ]);

  const preview: PreviewRow[] = [];
  const resolved: Resolved[] = [];
  const seenInFile = new Map<string, number>();
  for (const r of cleaned) {
    if (!r.value) {
      preview.push({ line: r.line, name: "", action: "error", errors: r.errors, warnings: [] });
      continue;
    }
    const v = r.value;
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!areaBySlug.has(v.area)) errors.push(`unknown area "${v.area}"`);
    for (const c of [v.category, ...v.other_categories]) if (!catBySlug.has(c)) errors.push(`unknown category "${c}"`);
    for (const a of v.attributes) if (!attrBySlug.has(a)) errors.push(`unknown attribute "${a}"`);

    const existing =
      (v.slug && bySlug.data?.find((l) => l.slug === v.slug)) ||
      (v.google_place_id && byPlace.data?.find((l) => l.google_place_id === v.google_place_id)) ||
      (v.phone && byPhone.data?.find((l) => l.phone === v.phone)) ||
      null;
    if (v.slug && !existing) warnings.push(`no listing with slug "${v.slug}"; a new one will be created`);
    if (!existing) {
      const key = normalizeName(v.name);
      const similar = inAreas.data?.find((l) => l.area_id === areaBySlug.get(v.area) && normalizeName(l.name) === key);
      // Skip likely duplicates instead of creating a second listing; a slug
      // column turns the row into an update.
      if (similar) errors.push(`looks like existing listing "${similar.slug}"; put that in the slug column to update it`);
      const dupLine = seenInFile.get(`${key}|${v.area}`);
      if (dupLine) errors.push(`same name and area as line ${dupLine}`);
      seenInFile.set(`${key}|${v.area}`, r.line);
    }

    if (errors.length) {
      preview.push({ line: r.line, name: v.name, action: "error", errors, warnings });
      continue;
    }
    preview.push({
      line: r.line,
      name: v.name,
      action: existing ? "update" : "create",
      matchSlug: existing?.slug,
      errors,
      warnings,
    });
    resolved.push({ value: v, line: r.line, existing: existing ? { id: existing.id, slug: existing.slug } : null });
  }
  return { preview, resolved, areaBySlug, catBySlug, attrBySlug };
}

const rowsSchema = z.array(z.record(z.string(), z.string())).max(MAX_IMPORT_ROWS);

export async function previewImport(rows: unknown): Promise<{ error?: string; preview?: PreviewRow[] }> {
  await requirePermission("listings.import");
  const parsed = rowsSchema.safeParse(rows);
  if (!parsed.success) return { error: `The file must have at most ${MAX_IMPORT_ROWS} rows.` };
  const { preview } = await resolveRows(parsed.data as ImportRow[]);
  return { preview };
}

export async function commitImport(
  filename: string,
  rows: unknown,
): Promise<{ error?: string; batchId?: number; counts?: Record<string, number> }> {
  const { user } = await requirePermission("listings.import");
  await requirePermission("listings.edit");
  const parsed = rowsSchema.safeParse(rows);
  if (!parsed.success) return { error: `The file must have at most ${MAX_IMPORT_ROWS} rows.` };
  const supabase = await createClient();
  const { resolved, preview, areaBySlug, catBySlug, attrBySlug } = await resolveRows(parsed.data as ImportRow[]);

  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .insert({ created_by: user.id, filename: filename.slice(0, 200) })
    .select("id")
    .single();
  if (batchError) return { error: "Could not start the import." };

  const counts = { created: 0, updated: 0, skipped: preview.filter((p) => p.action === "error").length, failed: 0 };
  const now = new Date().toISOString();
  for (const { value: v, existing } of resolved) {
    const fields = {
      name: v.name,
      status: v.status,
      area_id: areaBySlug.get(v.area)!,
      address: v.address,
      postcode: v.postcode,
      lat: v.lat,
      lng: v.lng,
      phone: v.phone,
      whatsapp: v.whatsapp,
      website: v.website,
      instagram: v.instagram,
      facebook: v.facebook,
      description: v.description,
      price_level: v.price_level,
      gender: v.gender,
      google_place_id: v.google_place_id,
      import_batch_id: batch.id,
      last_verified_at: now,
    };
    let listingId: string;
    if (existing) {
      const { data: before } = await supabase.from("listings").select("*").eq("id", existing.id).single();
      // Blank cells keep what is already there.
      const changes = Object.fromEntries(Object.entries(fields).filter(([, val]) => val !== null));
      const { error } = await supabase.from("listings").update(changes).eq("id", existing.id);
      if (error) {
        counts.failed++;
        continue;
      }
      listingId = existing.id;
      const { search: _search, ...snapshot } = before ?? {};
      void _search;
      await supabase.from("import_batch_rows").insert({ batch_id: batch.id, listing_id: listingId, action: "updated", before: snapshot });
      counts.updated++;
      updateTag(tags.listing(existing.slug));
    } else {
      const slug = await uniqueSlug(listingSlug(v.name, v.area), async (candidates) => {
        const { data } = await supabase.from("listings").select("slug").in("slug", candidates);
        return (data ?? []).map((r) => r.slug);
      });
      const { data, error } = await supabase
        .from("listings")
        .insert({ ...fields, status: v.status ?? "active", slug, source: "import", created_by: user.id })
        .select("id")
        .single();
      if (error) {
        counts.failed++;
        continue;
      }
      listingId = data.id;
      await supabase.from("import_batch_rows").insert({ batch_id: batch.id, listing_id: listingId, action: "created" });
      counts.created++;
    }

    const categoryIds = [v.category, ...v.other_categories].map((c) => catBySlug.get(c)!);
    await supabase.from("listing_categories").delete().eq("listing_id", listingId);
    await supabase
      .from("listing_categories")
      .insert([...new Set(categoryIds)].map((id) => ({ listing_id: listingId, category_id: id, is_primary: id === catBySlug.get(v.category) })));
    if (v.attributes.length) {
      await supabase
        .from("listing_attributes")
        .upsert(v.attributes.map((a) => ({ listing_id: listingId, attribute_id: attrBySlug.get(a)! })), { ignoreDuplicates: true });
    }
    if (v.hours) {
      await supabase.from("opening_hours").delete().eq("listing_id", listingId);
      if (v.hours.length) await supabase.from("opening_hours").insert(v.hours.map((h) => ({ ...h, listing_id: listingId })));
    }
  }

  await supabase.from("import_batches").update({ counts }).eq("id", batch.id);
  updateTag(tags.listings);
  revalidatePath("/admin", "layout");
  return { batchId: batch.id, counts };
}

// Undo: listings the batch created are archived; listings it updated get
// their previous values back.
export async function undoImport(batchId: number): Promise<ActionState> {
  await requirePermission("listings.import");
  const supabase = await createClient();
  const { data: batch } = await supabase.from("import_batches").select("id, status").eq("id", batchId).single();
  if (!batch || batch.status === "undone") return { error: "This import was already undone." };
  const { data: rows } = await supabase
    .from("import_batch_rows")
    .select("listing_id, action, before")
    .eq("batch_id", batchId);
  for (const row of rows ?? []) {
    if (row.action === "created") {
      await supabase.from("listings").update({ status: "archived" }).eq("id", row.listing_id);
    } else if (row.before) {
      const { id: _id, created_at: _c, updated_at: _u, ...restore } = row.before as Record<string, unknown>;
      void _id;
      void _c;
      void _u;
      await supabase.from("listings").update(restore).eq("id", row.listing_id);
    }
  }
  await supabase.from("import_batches").update({ status: "undone", undone_at: new Date().toISOString() }).eq("id", batchId);
  updateTag(tags.listings);
  revalidatePath("/admin", "layout");
  return { message: "Import undone." };
}

// ---------------------------------------------------------------------------
// Claims and reports
// ---------------------------------------------------------------------------

export async function reviewClaim(claimId: number, approve: boolean, note?: string): Promise<ActionState> {
  const { user, supabase } = await staffClient("claims.review");
  const { data: claim } = await supabase
    .from("claims")
    .select("id, listing_id, user_id, status, listings ( slug )")
    .eq("id", claimId)
    .single();
  if (!claim || claim.status !== "pending") return { error: "This claim was already handled." };
  if (approve) {
    const { error } = await supabase
      .from("listing_members")
      .upsert({ listing_id: claim.listing_id, user_id: claim.user_id, role: "owner" });
    if (error) return { error: "Could not add the owner." };
  }
  await supabase
    .from("claims")
    .update({
      status: approve ? "approved" : "rejected",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      note: note?.slice(0, 1000) || undefined,
    })
    .eq("id", claimId);
  refreshListing((claim as unknown as { listings: { slug: string } }).listings?.slug);
  return { message: approve ? "Approved." : "Rejected." };
}

export async function resolveReport(reportId: number, outcome: "resolved" | "dismissed"): Promise<void> {
  const { user, supabase } = await staffClient("reports.review");
  await supabase
    .from("reports")
    .update({ status: outcome, resolved_by: user.id, resolved_at: new Date().toISOString() })
    .eq("id", reportId);
  revalidatePath("/admin", "layout");
}

// ---------------------------------------------------------------------------
// Staff and roles (one role per person)
// ---------------------------------------------------------------------------

export async function addStaff(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { user, supabase } = await staffClient("staff.manage");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const roleId = Number(form.get("roleId"));
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !Number.isInteger(roleId)) {
    return { error: "Enter an email and pick a role." };
  }
  const admin = createAdminClient();
  let { data: userId } = await admin.rpc("staff_user_id_by_email", { p_email: email });
  if (!userId) {
    const invited = await admin.auth.admin.inviteUserByEmail(email);
    if (invited.error || !invited.data.user) return { error: "Could not invite that email." };
    userId = invited.data.user.id;
  }
  const { error } = await supabase.from("staff").upsert({ user_id: userId, role_id: roleId, invited_by: user.id });
  if (error) {
    return {
      error: error.code === "42501" ? "Only an Owner can give someone the Owner role." : "Could not add this person.",
    };
  }
  revalidatePath("/admin/staff");
  return { message: `${email} added.` };
}

export async function changeStaffRole(userId: string, roleId: number): Promise<ActionState> {
  const { supabase } = await staffClient("staff.manage");
  const { error } = await supabase.from("staff").update({ role_id: roleId }).eq("user_id", userId);
  revalidatePath("/admin/staff");
  return error ? { error: "Only an Owner can grant or remove the Owner role." } : { message: "Role changed." };
}

export async function removeStaff(userId: string): Promise<ActionState> {
  const { supabase } = await staffClient("staff.manage");
  const { error } = await supabase.from("staff").delete().eq("user_id", userId);
  revalidatePath("/admin/staff");
  return error ? { error: error.message.includes("yourself") ? "You can't remove yourself." : "Only an Owner can remove an Owner." } : {};
}

const roleSchema = z.object({
  id: z.coerce.number().int().optional(),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(200).optional(),
});

export async function saveRole(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await staffClient("staff.manage");
  const parsed = roleSchema.safeParse({
    id: form.get("id") || undefined,
    name: form.get("name"),
    description: form.get("description") || undefined,
  });
  if (!parsed.success) return { error: "A role needs a name." };
  const permissions = form.getAll("permissions").map(String).filter((p) => p !== "all");
  const values = { name: parsed.data.name, description: parsed.data.description ?? null, permissions };
  const { error } = parsed.data.id
    ? await supabase.from("roles").update(values).eq("id", parsed.data.id)
    : await supabase.from("roles").insert({ ...values, slug: slugify(parsed.data.name) });
  revalidatePath("/admin/staff");
  return error ? { error: "Could not save the role." } : { message: "Role saved." };
}

// ---------------------------------------------------------------------------
// Discovery queue, taxonomy, redirects
// ---------------------------------------------------------------------------

export async function setDiscoveryStatus(placeId: string, status: "new" | "collected" | "skipped", listingSlug?: string) {
  const { user, supabase } = await staffClient("listings.edit");
  let listingId: string | null = null;
  if (listingSlug) {
    const { data } = await supabase.from("listings").select("id").eq("slug", listingSlug.trim()).maybeSingle();
    listingId = data?.id ?? null;
  }
  await supabase
    .from("discovery_queue")
    .update({ status, listing_id: listingId, assigned_to: user.id })
    .eq("google_place_id", placeId);
  if (listingId) await supabase.from("listings").update({ google_place_id: placeId }).eq("id", listingId);
  revalidatePath("/admin/discovery");
}

export async function addArea(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await staffClient("taxonomy.edit");
  const name = String(form.get("name") ?? "").trim();
  const parent = String(form.get("parent") ?? "");
  if (!name) return { error: "Enter a name." };
  const { data: parentRow } = parent
    ? await supabase.from("areas").select("id, type").eq("slug", parent).single()
    : { data: null };
  const { error } = await supabase.from("areas").insert({
    name,
    slug: slugify(name),
    parent_id: parentRow?.id ?? null,
    type: !parentRow ? "city" : parentRow.type === "state" ? "city" : "area",
  });
  updateTag(tags.taxonomy);
  revalidatePath("/admin/taxonomy");
  return error ? { error: error.code === "23505" ? "That area already exists." : "Could not add." } : { message: `${name} added.` };
}

export async function addCategory(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await staffClient("taxonomy.edit");
  const nameEn = String(form.get("nameEn") ?? "").trim();
  const nameMs = String(form.get("nameMs") ?? "").trim();
  if (!nameEn || !nameMs) return { error: "Enter English and Malay names." };
  const { error } = await supabase.from("categories").insert({
    name_en: nameEn,
    name_ms: nameMs,
    slug: slugify(nameEn),
    slug_ms: slugify(nameMs) === slugify(nameEn) ? `${slugify(nameMs)}-ms` : slugify(nameMs),
    sort_order: 1000,
  });
  updateTag(tags.taxonomy);
  revalidatePath("/admin/taxonomy");
  return error ? { error: error.code === "23505" ? "That category already exists." : "Could not add." } : { message: `${nameEn} added.` };
}

export async function addRedirect(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await staffClient("seo.edit");
  const from = String(form.get("from") ?? "").trim();
  const to = String(form.get("to") ?? "").trim();
  if (!/^\/shop\/[a-z0-9-]+$/.test(from) || !to.startsWith("/")) {
    return { error: "The old path must look like /shop/old-name and the new one must start with /" };
  }
  const { error } = await supabase.from("redirects").upsert({ from_path: from, to_path: to });
  updateTag(tags.listings);
  revalidatePath("/admin/seo");
  return error ? { error: "Could not save." } : { message: "Redirect saved." };
}

export async function deleteRedirect(from: string) {
  const { supabase } = await staffClient("seo.edit");
  await supabase.from("redirects").delete().eq("from_path", from);
  updateTag(tags.listings);
  revalidatePath("/admin/seo");
}
