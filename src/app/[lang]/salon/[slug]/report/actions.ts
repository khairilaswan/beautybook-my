"use server";

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getActionI18n } from "@/lib/i18n/server";
import { clientIp } from "@/lib/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";

export type ReportState = { error?: string; done?: boolean };

const schema = z.object({
  listingId: z.uuid(),
  reason: z.enum(["closed", "wrong_phone", "wrong_info", "removal_request", "other"]),
  details: z.string().trim().max(2000).optional(),
  contact: z.string().trim().max(200).optional(),
});

export async function submitReport(_prev: ReportState, form: FormData): Promise<ReportState> {
  const { t } = await getActionI18n();
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: t.report.errors.reason };
  if (!(await verifyTurnstile(form.get("cf-turnstile-response") as string | null, await clientIp()))) {
    return { error: t.common.completeCheck };
  }
  const user = await getCurrentUser();
  const { error } = await createAdminClient().from("reports").insert({
    listing_id: parsed.data.listingId,
    user_id: user?.id ?? null,
    reason: parsed.data.reason,
    details: parsed.data.details || null,
    contact: parsed.data.contact || null,
  });
  if (error) return { error: t.report.errors.send };
  return { done: true };
}
