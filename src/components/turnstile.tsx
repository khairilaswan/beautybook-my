"use client";

import Script from "next/script";
import { turnstileSiteKey } from "@/lib/env";

// Renders Cloudflare's invisible-by-default challenge. The widget writes its
// token into a hidden input named cf-turnstile-response inside the form.
export function Turnstile() {
  if (!turnstileSiteKey) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      <div className="cf-turnstile" data-sitekey={turnstileSiteKey} data-size="flexible" />
    </>
  );
}
