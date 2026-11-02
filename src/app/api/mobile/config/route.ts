import { NextResponse } from "next/server";
import { connection } from "next/server";
import { siteUrl } from "@/lib/env";
import { getFeatureSettings } from "@/lib/data/features";
import { getLoginMethods } from "@/lib/login-methods";
import { paymentsEnabled } from "@/lib/setup";
import { membersOnly } from "@/lib/site-access";

// What the mobile app needs to know at start-up: whether the directory is
// members-only, which sign-in buttons work, and which features are on.
export async function GET() {
  await connection();
  const [loginMethods, features] = await Promise.all([getLoginMethods(), getFeatureSettings()]);
  return NextResponse.json(
    {
      membersOnly,
      loginMethods,
      reviewsEnabled: features.reviewsEnabled,
      referralPoints: features.referralPoints,
      paymentsEnabled: paymentsEnabled(),
      siteUrl,
      // Set MOBILE_MIN_VERSION (e.g. "1.2.0") to ask older app versions to update.
      minAppVersion: process.env.MOBILE_MIN_VERSION ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
