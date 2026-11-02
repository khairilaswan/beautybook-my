import { Platform } from "react-native";

// The website's default (Classic) palette from src/app/globals.css.
export const colors = {
  brand50: "#fdf2f6",
  brand100: "#fbe6ee",
  brand200: "#f8cddd",
  brand500: "#d9467a",
  brand600: "#c22c62",
  brand700: "#a2214f",
  ink: "#1c1917",
  muted: "#6b6461",
  line: "#ece7e4",
  canvas: "#fbf9f8",
  white: "#ffffff",
  whatsapp: "#1fa855",
  green50: "#f0fdf4",
  danger: "#b42318",
};

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };
export const space = (n: number) => n * 4;

export const shadow = Platform.select({
  ios: { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  default: { elevation: 1 },
});
