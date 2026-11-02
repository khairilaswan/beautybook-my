"use server";

import { getCurrentUser } from "@/lib/auth";
import { getActionI18n } from "@/lib/i18n/server";
import { type QuoteState, quoteRateLimited, quoteSchema, submitQuote } from "@/lib/quote";
import { clientHash, clientIp } from "@/lib/request";
import { verifyTurnstile } from "@/lib/turnstile";

export type { QuoteState };

// Bridal and event quotes. The logic lives in src/lib/quote.ts, shared with
// the mobile app.
export async function requestQuote(_prev: QuoteState, form: FormData): Promise<QuoteState> {
  const { locale, t } = await getActionI18n();
  const parsed = quoteSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message;
    return { error: issue === "name" ? t.booking.errors.name : issue === "phone" ? t.common.malaysianPhone : t.booking.errors.checkForm };
  }

  const ip = await clientIp();
  if (!(await verifyTurnstile(form.get("cf-turnstile-response") as string | null, ip))) {
    return { error: t.common.completeCheck };
  }
  const hash = clientHash(ip);
  if (await quoteRateLimited(hash)) return { error: t.booking.errors.tooMany };

  const user = await getCurrentUser();
  return submitQuote(parsed.data, { locale, t, userId: user?.id ?? null, hash });
}
