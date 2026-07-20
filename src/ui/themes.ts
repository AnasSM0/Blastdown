import { colors as reactorColors } from "./theme";

/** A complete visual theme. Themes are purely cosmetic — they remap colors and
 *  glow only, never gameplay. Block colors stay keyed by the three domain
 *  colorIds ("cyan"/"purple"/"amber"), so the engine is untouched; a theme
 *  just gives those three slots different hues. */
export type ThemePalette = {
  id: string;
  name: string;
  /** Cosmetic lock flag for the Themes screen. Unlock economy is deferred
   *  (see docs/DECISIONS.md) — nothing is gated at runtime yet. */
  locked: boolean;
  /** Bolt price shown on a locked tile (informational until the economy lands). */
  price: number;

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

  /** Glow intensity multiplier (1 = the Reactor baseline). */
  glow: number;
};

export const DEFAULT_THEME_ID = "neon-reactor";

const reactor: ThemePalette = {
  id: DEFAULT_THEME_ID,
  name: "Reactor",
  locked: false,
  price: 0,
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
  glow: 1,
};

const arctic: ThemePalette = {
  id: "arctic",
  name: "Arctic",
  locked: true,
  price: 500,
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
  glow: 0.9,
};

const magma: ThemePalette = {
  id: "magma",
  name: "Magma",
  locked: true,
  price: 500,
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
  glow: 1.2,
};

const voidTheme: ThemePalette = {
  id: "void",
  name: "Void",
  locked: true,
  price: 750,
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
  glow: 1.1,
};

const solar: ThemePalette = {
  id: "solar",
  name: "Solar",
  locked: true,
  price: 750,
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
