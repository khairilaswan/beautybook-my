import { createClient } from "@supabase/supabase-js";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";

// Anonymous client for public directory data. It never reads cookies, so it
// is safe inside `'use cache'` functions and the results are shared by all
// visitors.
export function createPublicClient() {
  return createClient(supabaseUrl(), supabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
