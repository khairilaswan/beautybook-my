import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

// Counts shop page views and contact clicks for the owner's analytics.
// Counts only: no visitor, IP or device is stored.
const body = z.object({
  listingId: z.uuid(),
  kind: z.enum(["view", "whatsapp", "call", "directions", "website"]),
});

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse/i;

export async function POST(request: NextRequest) {
  if (BOT.test(request.headers.get("user-agent") ?? "")) return new NextResponse(null, { status: 204 });
  let parsed;
  try {
    parsed = body.safeParse(JSON.parse(await request.text()));
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (!parsed.success) return new NextResponse(null, { status: 400 });
  const { error } = await createAdminClient().rpc("track_listing_event", {
    p_listing_id: parsed.data.listingId,
    p_kind: parsed.data.kind,
  });
  if (error) console.error("track failed", error.message);
  return new NextResponse(null, { status: 204 });
}
