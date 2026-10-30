import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";

// Used for direct uploads to Storage, which keeps large files off our
// server (Vercel caps request bodies at 4.5 MB). Storage RLS checks the path.
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabasePublishableKey());
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export async function uploadFile(
  bucket: "listing-photos" | "claim-evidence",
  folder: string,
  file: File,
  maxBytes: number,
): Promise<{ path: string } | { error: string }> {
  const ext = EXTENSIONS[file.type];
  if (!ext || (bucket === "listing-photos" && ext === "pdf")) {
    return { error: bucket === "listing-photos" ? "Please use a JPG, PNG or WebP photo." : "Please use a JPG, PNG, WebP or PDF." };
  }
  if (file.size > maxBytes) return { error: `The file is over ${Math.round(maxBytes / 1024 / 1024)} MB.` };
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await createClient().storage.from(bucket).upload(path, file, { contentType: file.type });
  if (error) return { error: "Upload failed. Please try again." };
  return { path };
}
