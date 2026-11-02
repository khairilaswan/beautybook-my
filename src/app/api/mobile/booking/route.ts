import { NextResponse, type NextRequest } from "next/server";
import { bookingRateLimited, bookingSchema, submitBooking } from "@/lib/booking";
import { jsonBody, jsonError, mobileContext } from "@/lib/mobile-api";

// Booking request from the app. A signed-in (and, while members-only,
// approved) account stands in for the website's captcha.
export async function POST(request: NextRequest) {
  const ctx = await mobileContext(request);
  if (ctx instanceof NextResponse) return ctx;
  const { t } = ctx;
  const parsed = bookingSchema.safeParse(await jsonBody(request));
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message === "name" ? t.booking.errors.name : t.booking.errors.checkForm, 400);
  }
  if (await bookingRateLimited(ctx.hash)) return jsonError(t.booking.errors.tooMany, 429);
  const result = await submitBooking(parsed.data, { locale: ctx.locale, t, userId: ctx.user!.id, hash: ctx.hash });
  return NextResponse.json(result, { status: result.error ? 422 : 200 });
}
