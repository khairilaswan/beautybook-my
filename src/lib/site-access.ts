// While SITE_ACCESS is anything but "public", only approved members can use
// the site. Set SITE_ACCESS=public in Vercel and redeploy to open it to all.
export const membersOnly = process.env.SITE_ACCESS !== "public";

// Pages anyone can open in members-only mode.
const OPEN_PATHS = ["/login", "/auth", "/privacy", "/pending"];

export function isOpenPath(pathname: string): boolean {
  return OPEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export type AccessStatus = "pending" | "approved" | "rejected";
