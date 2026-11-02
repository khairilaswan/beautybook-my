import * as WebBrowser from "expo-web-browser";
import { Alert, Linking } from "react-native";
import { SITE_URL } from "@/lib/env";

// wa.me links open the WhatsApp app when it's installed and WhatsApp Web in
// the browser otherwise, on both iOS and Android.
export async function openExternal(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert("", url);
  }
}

// Pages the app leaves to the website (claiming, reports, gift vouchers),
// shown in an in-app browser.
export async function openWebPage(path: string): Promise<void> {
  const url = path.startsWith("http") ? path : `${SITE_URL}${path}`;
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    await openExternal(url);
  }
}

export function mapsUrl(lat: number | null, lng: number | null, name: string, address: string | null): string {
  const query = lat !== null && lng !== null ? `${lat},${lng}` : [name, address].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

// The website's language prefix: English has none.
export function webPath(locale: "en" | "ms" | "zh", path: string): string {
  return locale === "en" ? path : `/${locale}${path}`;
}
