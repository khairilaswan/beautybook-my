import { NextResponse, type NextRequest } from "next/server";
import { jsonBody, jsonError, mobileContext } from "@/lib/mobile-api";
import { quoteRateLimited, quoteSchema, submitQuote } from "@/lib/quote";

// Bridal and event quote request from the app.
export async function POST(request: NextRequest) {
  const ctx = await mobileContext(request);
  if (ctx instanceof NextResponse) return ctx;
  const { t } = ctx;
  const parsed = quoteSchema.safeParse(await jsonBody(request));
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message;
    return jsonError(
      issue === "name" ? t.booking.errors.name : issue === "phone" ? t.common.malaysianPhone : t.booking.errors.checkForm,
      400,
    );
  }
  if (await quoteRateLimited(ctx.hash)) return jsonError(t.booking.errors.tooMany, 429);
  const result = await submitQuote(parsed.data, { locale: ctx.locale, t, userId: ctx.user!.id, hash: ctx.hash });
  return NextResponse.json(result, { status: result.error ? 422 : 200 });
}
