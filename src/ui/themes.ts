import { colors as reactorColors } from "./theme";

/** A complete visual theme. Themes are purely cosmetic — they remap colors and
 *  glow only, never gameplay. Block colors stay keyed by the three domain
 *  colorIds ("cyan"/"purple"/"amber"), so the engine is untouched; a theme
 *  just gives those three slots different hues. */
export type ThemePalette = {
  id: string;
  name: string;
  // Price and unlock status live in the authoritative catalog
  // (src/economy/themeCatalog.ts), not here — a palette is colors only.

  appBackground: string;
  surfaceBg: string;
  boardBg: string;
  boardFrame: string;
  gridLine: string;
  onSurface: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;

  /** The three block hues, keyed by domain colorId. */
  block: { cyan: string; purple: string; amber: string };

  timerNormal: string;
  timerWarning: string;
  timerCritical: string;

  rubbleFill: string;
  rubbleCrack: string;

  score: string;
  accent: string;

  /** Programmatic reactor-depth background (P1-2). Purely decorative, low
   *  contrast, and always behind gameplay — never a gameplay-critical color.
   *  Each hue is derived from the theme's own tones so no theme is "broken":
   *  `base` is the deepest full-bleed fill, `glow` a soft central lift, `seam`
   *  the panel divider, `grid` the faint circuit hairline, `corner` the corner
   *  bracket stroke. */
  background: {
    base: string;
    glow: string;
    seam: string;
    grid: string;
    corner: string;
  };

  /** Glow intensity multiplier (1 = the Reactor baseline). */
  glow: number;
};

export const DEFAULT_THEME_ID = "neon-reactor";

const reactor: ThemePalette = {
  id: DEFAULT_THEME_ID,
  name: "Reactor",
  appBackground: reactorColors.appBackground,
  surfaceBg: reactorColors.surfaceBg,
  boardBg: reactorColors.boardBg,
  boardFrame: reactorColors.boardFrame,
  gridLine: reactorColors.boardFrame,
  onSurface: reactorColors.onSurface,
  onSurfaceVariant: reactorColors.onSurfaceVariant,
  outline: reactorColors.outline,
  outlineVariant: reactorColors.outlineVariant,
  block: {
    cyan: reactorColors.cyanBlock,
    purple: reactorColors.purpleBlock,
    amber: reactorColors.amberBlock,
  },
  timerNormal: reactorColors.cyanBlock,
  timerWarning: reactorColors.amberBlock,
  timerCritical: reactorColors.urgentRed,
  rubbleFill: reactorColors.boardFrame,
  rubbleCrack: reactorColors.outline,
  score: reactorColors.scoreOrange,
  accent: reactorColors.cyanBlock,
  // Reactor is nudged toward the Premium deep navy/graphite reference here:
  // the flat near-black screen gains navy depth from the background layer,
  // while the appBackground token itself is left unchanged.
  background: {
    base: "#070C16",
    glow: "#101A30",
    seam: "#18233A",
    grid: "#0E1626",
    corner: "#243350",
  },
  glow: 1,
};

const arctic: ThemePalette = {
  id: "arctic",
  name: "Arctic",
  appBackground: "#03080F",
  surfaceBg: "#0C1A2A",
  boardBg: "#0A1622",
  boardFrame: "#1E3A4C",
  gridLine: "#1E3A4C",
  onSurface: "#E6F6FF",
  onSurfaceVariant: "#A9C7D8",
  outline: "#5E8298",
  outlineVariant: "#274355",
  block: { cyan: "#7DE3FF", purple: "#8AB4FF", amber: "#E8F6FF" },
  timerNormal: "#7DE3FF",
  timerWarning: "#FFD27D",
  timerCritical: "#FF6B8B",
  rubbleFill: "#20323F",
  rubbleCrack: "#5E8298",
  score: "#7DE3FF",
  accent: "#8AB4FF",
  background: {
    base: "#04090F",
    glow: "#0B1A2A",
    seam: "#173141",
    grid: "#0A141F",
    corner: "#1E3A4C",
  },
  glow: 0.9,
};

const magma: ThemePalette = {
  id: "magma",
  name: "Magma",
  appBackground: "#0A0503",
  surfaceBg: "#1E0E08",
  boardBg: "#160A06",
  boardFrame: "#3A1D12",
  gridLine: "#3A1D12",
  onSurface: "#FFE9DC",
  onSurfaceVariant: "#D8A88F",
  outline: "#9A6146",
  outlineVariant: "#4A2417",
  block: { cyan: "#FFB347", purple: "#FF5A3C", amber: "#FFD23F" },
  timerNormal: "#FFB347",
  timerWarning: "#FF7A1A",
  timerCritical: "#FF2E2E",
  rubbleFill: "#2A1811",
  rubbleCrack: "#9A6146",
  score: "#FF7A1A",
  accent: "#FFB347",
  background: {
    base: "#0A0604",
    glow: "#1B0D07",
    seam: "#301810",
    grid: "#150A06",
    corner: "#3A1D12",
  },
  glow: 1.2,
};

const voidTheme: ThemePalette = {
  id: "void",
  name: "Void",
  appBackground: "#040308",
  surfaceBg: "#120C1F",
  boardBg: "#0C0817",
  boardFrame: "#241738",
  gridLine: "#241738",
  onSurface: "#ECE4FF",
  onSurfaceVariant: "#B6A6D2",
  outline: "#6B5990",
  outlineVariant: "#2E2046",
  block: { cyan: "#C77DFF", purple: "#7B2FFF", amber: "#FF6EC7" },
  timerNormal: "#C77DFF",
  timerWarning: "#FFB86C",
  timerCritical: "#FF4D6D",
  rubbleFill: "#1C1430",
  rubbleCrack: "#6B5990",
  score: "#C77DFF",
  accent: "#FF6EC7",
  background: {
    base: "#050409",
    glow: "#130C22",
    seam: "#241738",
    grid: "#0F0A1B",
    corner: "#33224E",
  },
  glow: 1.1,
};

const solar: ThemePalette = {
  id: "solar",
  name: "Solar",
  appBackground: "#0B0703",
  surfaceBg: "#211608",
  boardBg: "#181005",
  boardFrame: "#3E2C12",
  gridLine: "#3E2C12",
  onSurface: "#FFF4DE",
  onSurfaceVariant: "#D8BE8C",
  outline: "#9A7A44",
  outlineVariant: "#4A3518",
  block: { cyan: "#FFD447", purple: "#FF9E2C", amber: "#FFF08A" },
  timerNormal: "#FFD447",
  timerWarning: "#FF9E2C",
  timerCritical: "#FF5230",
  rubbleFill: "#2A1E0C",
  rubbleCrack: "#9A7A44",
  score: "#FFD447",
  accent: "#FF9E2C",
  background: {
    base: "#0B0804",
    glow: "#1C1207",
    seam: "#301F0C",
    grid: "#150E06",
    corner: "#3E2C12",
  },
  glow: 1.05,
};

export const THEMES: readonly ThemePalette[] = [reactor, arctic, magma, voidTheme, solar];

const THEME_BY_ID = new Map(THEMES.map((theme) => [theme.id, theme]));

/** Resolve a persisted themeId to a palette, falling back to Reactor for an
 *  unknown id so a corrupt/old setting never breaks rendering. */
export function resolveTheme(themeId: string | undefined): ThemePalette {
  return (themeId && THEME_BY_ID.get(themeId)) || reactor;
}

/** Block hue for a domain colorId under a theme (defaults to the outline for an
 *  unknown id, mirroring the previous pieceColor behavior). */
export function blockColor(theme: ThemePalette, colorId: string): string {
  if (colorId === "cyan" || colorId === "purple" || colorId === "amber") {
    return theme.block[colorId];
  }
  return theme.outline;
}

/** Themed neon glow — the Reactor baseline scaled by the theme's glow factor. */
export function glowFor(theme: ThemePalette, color: string, intensity: "low" | "high") {
  const high = intensity === "high";
  return {
    shadowColor: color,
    shadowOpacity: 0.6,
    shadowRadius: (high ? 20 : 8) * theme.glow,
    shadowOffset: { width: 0, height: 0 },
    elevation: Math.round((high ? 12 : 6) * theme.glow),
  };
}
