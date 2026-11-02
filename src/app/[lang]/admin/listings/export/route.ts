import Papa from "papaparse";
import { type NextRequest } from "next/server";
import { queryListings, readFilters } from "@/app/admin/listings/query";
import { requirePermission } from "@/lib/auth";

// Exports the filtered listings in the same columns the importer accepts, so
// an export can be edited in Excel and imported back.
export async function GET(request: NextRequest) {
  await requirePermission("listings.edit");
  const filters = readFilters(Object.fromEntries(request.nextUrl.searchParams));
  const { data } = await queryListings(
    filters,
    `slug, name, status, address, postcode, lat, lng, phone, whatsapp, website, instagram, facebook, description,
     price_level, gender, google_place_id, areas ( slug ),
     listing_categories ( is_primary, categories ( slug ) ), listing_attributes ( attributes ( slug ) )`,
    20000,
  );
  type Row = Record<string, unknown> & {
    areas: { slug: string } | null;
    listing_categories: { is_primary: boolean; categories: { slug: string } }[];
    listing_attributes: { attributes: { slug: string } }[];
  };
  const rows = ((data ?? []) as unknown as Row[]).map(({ areas, listing_categories, listing_attributes, ...l }) => ({
    ...l,
    area: areas?.slug ?? "",
    category: listing_categories.find((c) => c.is_primary)?.categories.slug ?? "",
    other_categories: listing_categories.filter((c) => !c.is_primary).map((c) => c.categories.slug).join(";"),
    attributes: listing_attributes.map((a) => a.attributes.slug).join(";"),
  }));
  const csv = Papa.unparse(rows);
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="beautybook-listings-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
