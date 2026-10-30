// Gives an existing user the Owner role, which can then add other staff from
// the admin portal. Sign in to the site once first so the account exists.
//
//   node --env-file=.env.local scripts/make-owner.ts you@example.com

const email = process.argv[2];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!email || !url || !key) {
  console.error("Usage: node --env-file=.env.local scripts/make-owner.ts you@example.com");
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

const userRes = await fetch(`${url}/rest/v1/rpc/staff_user_id_by_email`, {
  method: "POST",
  headers,
  body: JSON.stringify({ p_email: email }),
});
const userId = (await userRes.json()) as string | null;
if (!userRes.ok || !userId) {
  console.error(`No account for ${email}. Sign in to the site once, then run this again.`);
  process.exit(1);
}

const roleRes = await fetch(`${url}/rest/v1/roles?slug=eq.owner&select=id`, { headers });
const [role] = (await roleRes.json()) as { id: number }[];

const res = await fetch(`${url}/rest/v1/staff?on_conflict=user_id`, {
  method: "POST",
  headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
  body: JSON.stringify({ user_id: userId, role_id: role.id }),
});
if (!res.ok) {
  console.error(`Failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}
console.log(`${email} is now an Owner.`);
export {};
