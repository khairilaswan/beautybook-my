import { NextResponse, type NextRequest } from "next/server";
import { jsonError, mobileContext } from "@/lib/mobile-api";
import { createAdminClient } from "@/lib/supabase/admin";

// Deletes the signed-in account and everything tied to it (profile,
// favourites, notes, history, shop memberships cascade; past booking
// requests stay with the shop without the account link). App Store and
// Google Play both require in-app account deletion.
export async function DELETE(request: NextRequest) {
  const ctx = await mobileContext(request, { allowPending: true });
  if (ctx instanceof NextResponse) return ctx;
  const admin = createAdminClient();
  const userId = ctx.user!.id;

  // Staff accounts hold admin roles and audit history; the platform owner
  // removes them from /admin/staff first.
  const { data: staff } = await admin.from("staff").select("user_id").eq("user_id", userId).maybeSingle();
  if (staff) {
    return jsonError("Staff accounts can't be deleted from the app. Ask the platform owner to remove your staff role first.", 409);
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error("account deletion failed", error.message);
    return jsonError(ctx.t.common.tryAgain, 500);
  }
  return new NextResponse(null, { status: 204 });
}
