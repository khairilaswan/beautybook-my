import "server-only";
import { daysAgoIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export type ListingFilters = {
  q?: string;
  status?: string;
  area?: string;
  source?: string;
  stale?: string;
  page?: number;
};

export const ADMIN_PAGE_SIZE = 50;

export function readFilters(raw: Record<string, string | string[] | undefined>): ListingFilters {
  const one = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : undefined);
  return {
    q: one("q"),
    status: one("status"),
    area: one("area"),
    source: one("source"),
    stale: one("stale"),
    page: Math.max(1, Number(one("page")) || 1),
  };
}

// Shared by the listings table and the CSV export.
export async function queryListings(f: ListingFilters, columns: string, limit: number, offset = 0) {
  const supabase = await createClient();
  let query = supabase.from("listings").select(columns, { count: "exact" });
  if (f.q) {
    const term = f.q.replace(/[%,()]/g, " ").trim();
    query = query.or(`name.ilike.%${term}%,slug.ilike.%${term}%,phone.ilike.%${term.replace(/\D/g, "") || "x"}%`);
  }
  if (f.status) query = query.eq("status", f.status);
  if (f.source) query = query.eq("source", f.source);
  if (f.stale) query = query.lt("last_verified_at", daysAgoIso(180));
  if (f.area) {
    const { data: ids } = await supabase.rpc("area_tree", { p_slug: f.area });
    query = query.in("area_id", ((ids as unknown as number[]) ?? []).map(Number));
  }
  return query.order("updated_at", { ascending: false }).range(offset, offset + limit - 1);
}
