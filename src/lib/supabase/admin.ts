import "server-only";
import { createClient } from "@supabase/supabase-js";
import { required, supabaseUrl } from "@/lib/env";

// Bypasses RLS. Use only after the caller has been checked in code, and only
// for writes RLS deliberately does not allow (booking requests from guests,
// claim approval, claim codes).
export function createAdminClient() {
  return createClient(supabaseUrl(), required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
