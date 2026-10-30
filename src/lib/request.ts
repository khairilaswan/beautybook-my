import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

// A salted, daily-rotating hash of the client IP, used only for rate limits.
export function clientHash(ip: string | null): string | null {
  if (!ip) return null;
  const day = new Date().toISOString().slice(0, 10);
  const salt = process.env.SUPABASE_SECRET_KEY ?? "dev";
  return createHash("sha256").update(`${salt}:${day}:${ip}`).digest("hex").slice(0, 32);
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export function shortCode(length = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
