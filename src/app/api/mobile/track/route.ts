import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { jsonBody, mobileContext } from "@/lib/mobile-api";
import { createAdminClient } from "@/lib/supabase/admin";

// Shop page views and contact taps in the app, for the owner's analytics.
// Same counters as /api/track: counts only, nothing about the visitor.
const body = z.object({
  listingId: z.uuid(),
  kind: z.enum(["view", "whatsapp", "call", "directions", "website"]),
});

export async function POST(request: NextRequest) {
  const ctx = await mobileContext(request, { optional: true });
  if (ctx instanceof NextResponse) return ctx;
  const parsed = body.safeParse(await jsonBody(request));
  if (!parsed.success) return new NextResponse(null, { status: 400 });
  const { error } = await createAdminClient().rpc("track_listing_event", {
    p_listing_id: parsed.data.listingId,
    p_kind: parsed.data.kind,
  });
  if (error) console.error("track failed", error.message);
  return new NextResponse(null, { status: 204 });
}
