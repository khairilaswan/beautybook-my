import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { supabase } from "@/lib/supabase";

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const LOOKUP = new Uint8Array(128);
for (let i = 0; i < B64.length; i++) LOOKUP[B64.charCodeAt(i)] = i;

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, "");
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = LOOKUP[clean.charCodeAt(i)];
    const b = LOOKUP[clean.charCodeAt(i + 1)];
    const c = i + 2 < clean.length ? LOOKUP[clean.charCodeAt(i + 2)] : 0;
    const d = i + 3 < clean.length ? LOOKUP[clean.charCodeAt(i + 3)] : 0;
    const n = (a << 18) | (b << 12) | (c << 6) | d;
    if (p < bytes.length) bytes[p++] = (n >> 16) & 255;
    if (i + 2 < clean.length && p < bytes.length) bytes[p++] = (n >> 8) & 255;
    if (i + 3 < clean.length && p < bytes.length) bytes[p++] = n & 255;
  }
  return bytes;
}

const MAX_SIDE = 2000;
const MAX_BYTES = 5 * 1024 * 1024; // the listing-photos bucket's limit

// Phone photos are often HEIC and very large; the bucket takes JPG, PNG or
// WebP up to 5 MB. Re-encode as a JPEG no wider or taller than 2000px, then
// upload to listing-photos/<listingId>/<random>.jpg.
export async function uploadListingPhoto(
  listingId: string,
  asset: { uri: string; width: number; height: number },
): Promise<{ path: string } | { error: string }> {
  try {
    const context = ImageManipulator.manipulate(asset.uri);
    if (asset.width > MAX_SIDE || asset.height > MAX_SIDE) {
      context.resize(asset.width >= asset.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
    }
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
    if (!saved.base64) return { error: "Could not read the photo." };
    const bytes = base64ToBytes(saved.base64);
    if (bytes.byteLength > MAX_BYTES) return { error: "The photo is over 5 MB." };
    const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.jpg`;
    const path = `${listingId}/${name}`;
    const { error } = await supabase.storage.from("listing-photos").upload(path, bytes, { contentType: "image/jpeg" });
    if (error) return { error: "Upload failed. Please try again." };
    return { path };
  } catch (e) {
    console.warn("photo upload failed", e);
    return { error: "Upload failed. Please try again." };
  }
}
