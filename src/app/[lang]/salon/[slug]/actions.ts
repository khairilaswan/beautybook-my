"use server";

import type { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  type BookingState,
  availability,
  type availabilitySchema,
  bookingRateLimited,
  bookingSchema,
  submitBooking,
} from "@/lib/booking";
import { getActionI18n } from "@/lib/i18n/server";
import { clientHash, clientIp } from "@/lib/request";
import type { Slot } from "@/lib/slots";
import { verifyTurnstile } from "@/lib/turnstile";

export type { BookingState };

// The booking logic lives in src/lib/booking.ts, shared with the mobile app.
export async function createBookingRequest(_prev: BookingState, form: FormData): Promise<BookingState> {
  const { locale, t } = await getActionI18n();
  const parsed = bookingSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message === "name" ? t.booking.errors.name : t.booking.errors.checkForm };
  }

  const ip = await clientIp();
  if (!(await verifyTurnstile(form.get("cf-turnstile-response") as string | null, ip))) {
    return { error: t.common.completeCheck };
  }

  const hash = clientHash(ip);
  if (await bookingRateLimited(hash)) {
    return { error: t.booking.errors.tooMany };
  }

  const user = await getCurrentUser();
  return submitBooking(parsed.data, { locale, t, userId: user?.id ?? null, hash });
}

// For the booking form: which times are still free on a day.
export async function getAvailability(input: z.input<typeof availabilitySchema>): Promise<Slot[]> {
  return availability(input);
}
