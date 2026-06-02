export const COLORS = {
  background: "#0A0A0A",
  surface: "#1A1A1A",
  surfaceActive: "#262626",
  primary: "#6F61EF",
  primaryFg: "#FFFFFF",
  secondary: "#39D2C0",
  secondaryFg: "#000000",
  textPrimary: "#FFFFFF",
  textSecondary: "#A1A1AA",
  border: "rgba(255,255,255,0.1)",
  borderStrong: "rgba(255,255,255,0.2)",
  success: "#39D2C0",
  error: "#FF3B30",
  overlay: "rgba(0,0,0,0.6)",
};

export const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };

export const RADII = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };

export const FONT = {
  // System fallback; in RN we don't load Barlow Condensed by default
  heading: undefined as undefined | string,
  body: undefined as undefined | string,
};
