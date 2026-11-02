import { NextResponse, type NextRequest } from "next/server";
import { availability } from "@/lib/booking";
import { jsonBody, mobileContext } from "@/lib/mobile-api";

// Free times on one day for shops that take instant bookings.
export async function POST(request: NextRequest) {
  const ctx = await mobileContext(request, { optional: true });
  if (ctx instanceof NextResponse) return ctx;
  const body = await jsonBody(request);
  const slots = await availability({
    listingId: String(body.listingId ?? ""),
    date: String(body.date ?? ""),
    serviceId: Number(body.serviceId),
    staffId: body.staffId === null || body.staffId === undefined ? null : Number(body.staffId),
  });
  return NextResponse.json({ slots });
}
