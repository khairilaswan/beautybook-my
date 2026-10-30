import { normalizeMalaysianPhone } from "@/lib/phone";

// Columns accepted by the bulk import (CSV, XLSX or JSON). Only `name`,
// `category` and `area` are required. Lists use ";" as separator.
export const IMPORT_COLUMNS = [
  "slug",
  "name",
  "category",
  "other_categories",
  "area",
  "address",
  "postcode",
  "lat",
  "lng",
  "phone",
  "whatsapp",
  "website",
  "instagram",
  "facebook",
  "description",
  "price_level",
  "gender",
  "attributes",
  "hours",
  "google_place_id",
  "status",
] as const;

export const IMPORT_EXAMPLE: Record<(typeof IMPORT_COLUMNS)[number], string> = {
  slug: "",
  name: "Classic Barber",
  category: "barbershop",
  other_categories: "",
  area: "bangsar",
  address: "12 Jalan Telawi 3, Bangsar Baru",
  postcode: "59100",
  lat: "3.1301",
  lng: "101.6707",
  phone: "012-345 6789",
  whatsapp: "",
  website: "",
  instagram: "https://instagram.com/classicbarber",
  facebook: "",
  description: "Walk-in barbershop with skin fades and beard trims.",
  price_level: "1",
  gender: "men",
  attributes: "walk-in;speaks-malay",
  hours: "Mon-Sat 10:00-21:00; Fri 10:00-13:00,14:30-21:00",
  google_place_id: "",
  status: "active",
};

// Each row is a few database calls inside one server action; keep files small
// enough to finish well inside the function time limit.
export const MAX_IMPORT_ROWS = 500;

export type ImportRow = Partial<Record<(typeof IMPORT_COLUMNS)[number], string>>;

export type CleanListing = {
  slug: string | null;
  name: string;
  category: string;
  other_categories: string[];
  area: string;
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
  gender: "men" | "women" | "unisex" | null;
  attributes: string[];
  hours: { weekday: number; opens: string; closes: string }[] | null;
  google_place_id: string | null;
  // Null when the cell is blank: new listings go live, updates keep their status.
  status: "active" | "closed" | "hidden" | null;
};

const DAY_INDEX: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

// "Mon-Sat 10:00-21:00; Fri 10:00-13:00,14:30-21:00". A later group for the
// same day replaces the earlier one, so exceptions can follow a range.
export function parseHours(text: string): CleanListing["hours"] | string {
  const byDay = new Map<number, { opens: string; closes: string }[]>();
  for (const group of text.split(";").map((g) => g.trim()).filter(Boolean)) {
    const m = group.match(/^([a-z]{3})(?:\s*-\s*([a-z]{3}))?\s+(.+)$/i);
    if (!m) return `can't read hours "${group}"`;
    const start = DAY_INDEX[m[1].toLowerCase()];
    const end = m[2] ? DAY_INDEX[m[2].toLowerCase()] : start;
    if (start === undefined || end === undefined) return `unknown day in "${group}"`;
    const slots: { opens: string; closes: string }[] = [];
    if (m[3].trim().toLowerCase() !== "closed") {
      for (const range of m[3].split(",")) {
        const t = range.trim().match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
        if (!t || Number(t[1]) > 23 || Number(t[3]) > 23 || Number(t[2]) > 59 || Number(t[4]) > 59) {
          return `can't read time "${range.trim()}"`;
        }
        slots.push({ opens: `${t[1].padStart(2, "0")}:${t[2]}`, closes: `${t[3].padStart(2, "0")}:${t[4]}` });
      }
    }
    for (let d = start; ; d = (d + 1) % 7) {
      byDay.set(d, slots);
      if (d === end) break;
    }
  }
  return [...byDay.entries()].flatMap(([weekday, slots]) => slots.map((s) => ({ weekday, ...s })));
}

const list = (v: string | undefined) =>
  (v ?? "")
    .split(";")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
const text = (v: string | undefined) => (v?.trim() ? v.trim() : null);

function url(v: string | undefined): string | null | Error {
  const t = text(v);
  if (!t) return null;
  try {
    const u = new URL(t.startsWith("http") ? t : `https://${t}`);
    return u.toString();
  } catch {
    return new Error(`"${t}" is not a link`);
  }
}

export function cleanRow(row: ImportRow): { value?: CleanListing; errors: string[] } {
  const errors: string[] = [];
  const name = text(row.name);
  const category = text(row.category)?.toLowerCase();
  const area = text(row.area)?.toLowerCase();
  if (!name) errors.push("name is missing");
  if (!category) errors.push("category is missing");
  if (!area) errors.push("area is missing");

  const phoneRaw = text(row.phone);
  const phone = phoneRaw ? normalizeMalaysianPhone(phoneRaw) : null;
  if (phoneRaw && !phone) errors.push(`phone "${phoneRaw}" is not a Malaysian number`);
  const waRaw = text(row.whatsapp);
  const whatsapp = waRaw ? normalizeMalaysianPhone(waRaw) : null;
  if (waRaw && !whatsapp) errors.push(`whatsapp "${waRaw}" is not a Malaysian number`);

  const num = (v: string | undefined, label: string, min: number, max: number) => {
    const t = text(v);
    if (t === null) return null;
    const n = Number(t);
    if (!Number.isFinite(n) || n < min || n > max) {
      errors.push(`${label} "${t}" is out of range`);
      return null;
    }
    return n;
  };
  const lat = num(row.lat, "lat", 0.5, 7.5);
  const lng = num(row.lng, "lng", 99.5, 119.5);
  const price = num(row.price_level, "price_level", 1, 4);

  const postcode = text(row.postcode);
  if (postcode && !/^\d{5}$/.test(postcode)) errors.push(`postcode "${postcode}" should be 5 digits`);

  const gender = text(row.gender)?.toLowerCase() ?? null;
  if (gender && !["men", "women", "unisex"].includes(gender)) errors.push(`gender "${gender}" should be men, women or unisex`);
  const status = text(row.status)?.toLowerCase() ?? null;
  if (status && !["active", "closed", "hidden"].includes(status)) errors.push(`status "${status}" should be active, closed or hidden`);

  const links = { website: url(row.website), instagram: url(row.instagram), facebook: url(row.facebook) };
  for (const v of Object.values(links)) if (v instanceof Error) errors.push(v.message);

  let hours: CleanListing["hours"] = null;
  const hoursText = text(row.hours);
  if (hoursText) {
    const parsed = parseHours(hoursText);
    if (typeof parsed === "string") errors.push(parsed);
    else hours = parsed;
  }

  if (errors.length) return { errors };
  return {
    errors,
    value: {
      slug: text(row.slug)?.toLowerCase() ?? null,
      name: name!,
      category: category!,
      other_categories: list(row.other_categories),
      area: area!,
      address: text(row.address),
      postcode,
      lat,
      lng,
      phone,
      whatsapp,
      website: links.website as string | null,
      instagram: links.instagram as string | null,
      facebook: links.facebook as string | null,
      description: text(row.description),
      price_level: price,
      gender: gender as CleanListing["gender"],
      attributes: list(row.attributes),
      hours,
      google_place_id: text(row.google_place_id),
      status: status as CleanListing["status"],
    },
  };
}

// For spotting likely duplicates: "Classic Barber Sdn. Bhd." ~ "classic barber".
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(sdn\.?\s*bhd\.?|enterprise|ent\.?|plt|salon|studio|the)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
