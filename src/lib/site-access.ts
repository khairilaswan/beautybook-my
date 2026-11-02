// While SITE_ACCESS is anything but "public", only approved members can use
// the site. Set SITE_ACCESS=public in Vercel and redeploy to open it to all.
export const membersOnly = process.env.SITE_ACCESS !== "public";

// Pages anyone can open in members-only mode.
// Invite links stay open so a friend can see who invited them before signing up.
// The mobile app's API checks its own Bearer token (src/lib/mobile-api.ts).
const OPEN_PATHS = ["/login", "/auth", "/privacy", "/pending", "/invite", "/api/payments/webhook", "/api/cron", "/api/mobile"];

export function isOpenPath(pathname: string): boolean {
  return OPEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export type AccessStatus = "pending" | "approved" | "rejected";
