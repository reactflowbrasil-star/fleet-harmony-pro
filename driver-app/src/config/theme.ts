/**
 * FrotaGo — driver app theme
 * Dark palette + vibrant orange accent.
 */

export const colors = {
  // Surfaces
  background: "#0A0A0F",
  backgroundElevated: "#13131A",
  card: "#16161D",
  cardElevated: "#1C1C24",
  border: "#262630",
  borderSubtle: "#1F1F28",

  // Text
  foreground: "#F5F5F7",
  mutedForeground: "#9A9AA5",
  subtleForeground: "#6B6B75",

  // Brand
  primary: "#FF6B1A",
  primaryHover: "#FF7E33",
  primaryForeground: "#FFFFFF",
  primaryGlow: "rgba(255, 107, 26, 0.25)",

  // Semantic
  success: "#22C55E",
  successBg: "rgba(34, 197, 94, 0.15)",
  warning: "#F59E0B",
  warningBg: "rgba(245, 158, 11, 0.15)",
  destructive: "#EF4444",
  destructiveBg: "rgba(239, 68, 68, 0.15)",

  // Map (matched to mockup orange route)
  mapRoute: "#FF6B1A",

  // Bottom nav
  navInactive: "#6B6B75",
  navActive: "#FF6B1A",
} as const;

export const radii = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const text = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 26,
  title: 28,
  display: 36,
} as const;

export const weight = {
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
  black: "800" as const,
};

export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  primary: {
    shadowColor: "#FF6B1A",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
};
