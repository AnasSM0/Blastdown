import { type TextStyle, type ViewStyle } from "react-native";

/** Neon Reactor design tokens, extracted from the approved Stitch snapshot
 *  (docs/STYLE_GUIDE.md). Visual reference only — never gameplay values. */

/** Loaded font-family names (docs/STYLE_GUIDE.md typography). These are plain
 *  strings so any module can reference them without importing the font
 *  binaries — only src/ui/fonts.ts (used by the root layout) loads the actual
 *  faces via expo-font. Until a face loads, or if loading fails, React Native
 *  falls back to the system font for that name — a safe, automatic fallback. */
export const fonts = {
  /** Geist — UI text, labels, buttons, body. */
  uiRegular: "Geist_400Regular",
  uiSemiBold: "Geist_600SemiBold",
  /** JetBrains Mono — all numeric displays (score, timer, stat values). */
  monoMedium: "JetBrainsMono_500Medium",
  monoSemiBold: "JetBrainsMono_600SemiBold",
  monoBold: "JetBrainsMono_700Bold",
} as const;

export const colors = {
  appBackground: "#050505",
  surfaceBg: "#0B1326",
  boardBg: "#0F172A",
  boardFrame: "#2D2D35",
  cyanBlock: "#00F0FF",
  purpleBlock: "#9D05FF",
  amberBlock: "#FFBA20",
  scoreOrange: "#FF6B00",
  onSurface: "#DAE2FD",
  onSurfaceVariant: "#B9CACB",
  outline: "#849495",
  outlineVariant: "#3B494B",
  error: "#FFB4AB",
  urgentRed: "#FF003D",
} as const;

export type ThemeColor = keyof typeof colors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  screenPadding: 20,
  gridGutter: 2,
} as const;

export const radius = {
  cell: 2,
  board: 8,
  panel: 12,
  pill: 999,
} as const;

export const typography = {
  body: {
    fontFamily: fonts.uiRegular,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400",
    color: colors.onSurface,
  },
  buttonText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    letterSpacing: 0.3,
    color: colors.onSurface,
  },
  labelCaps: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.onSurfaceVariant,
  },
  timerMono: {
    fontFamily: fonts.monoMedium,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "500",
    color: colors.onSurface,
  },
  scoreMobile: {
    fontFamily: fonts.monoBold,
    fontSize: 36,
    lineHeight: 40,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    color: colors.scoreOrange,
  },
  numericValue: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    color: colors.onSurface,
  },
} satisfies Record<string, TextStyle>;

export type GlowIntensity = "low" | "high";

/** The recurring "neon" motif: colored outer glow via shadow/elevation.
 *  Deliberately no per-cell blur (docs/UI_REFERENCE_AUDIT.md item 9). */
export function neonGlow(color: string, intensity: GlowIntensity): ViewStyle {
  const high = intensity === "high";
  return {
    shadowColor: color,
    shadowOpacity: 0.6,
    shadowRadius: high ? 20 : 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: high ? 12 : 6,
  };
}

export const theme = { colors, spacing, radius, typography, neonGlow } as const;

export type Theme = typeof theme;
