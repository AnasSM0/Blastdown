import type { ThemePalette } from "../../ui/themes";
import type { CinematicPalette } from "./types";

/** Theme to canvas colours.
 *
 *  Every cinematic tone is DERIVED from the active theme rather than authored,
 *  so all five themes (Reactor, Arctic, Magma, Void, Solar) gain the recessed
 *  frame, the rim light, the ambience and the vignette without any of them
 *  needing new tokens — and so a sixth theme added later is correct by default
 *  instead of correct only if someone remembers to extend this file.
 *
 *  The derivation is deliberately conservative. Lifting a dark theme's frame
 *  toward white produces a rim; sinking it toward black produces the shadow that
 *  makes the board read as a recess rather than a raised panel. Nothing here
 *  invents a hue: a theme's identity survives because every derived tone is that
 *  theme's own colour moved along the light axis. */

function clamp255(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function toHex2(value: number): string {
  return clamp255(value).toString(16).padStart(2, "0");
}

function channels(hex: string): [number, number, number] {
  const raw = hex.startsWith("#") ? hex.slice(1) : hex;
  const full =
    raw.length === 3
      ? `${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`
      : raw.slice(0, 6).padEnd(6, "0");
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** Linear blend between two opaque colours. `t` = 0 yields `a`, 1 yields `b`. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = channels(a);
  const [br, bg, bb] = channels(b);
  const k = Math.max(0, Math.min(1, t));
  return `#${toHex2(ar + (br - ar) * k)}${toHex2(ag + (bg - ag) * k)}${toHex2(ab + (bb - ab) * k)}`;
}

/** Lift a colour toward white. */
export function lighten(color: string, amount: number): string {
  return mix(color, "#FFFFFF", amount);
}

/** Sink a colour toward black. */
export function darken(color: string, amount: number): string {
  return mix(color, "#000000", amount);
}

/** Append an alpha byte to an opaque colour. Skia parses `#RRGGBBAA`. */
export function alpha(color: string, value: number): string {
  const raw = color.startsWith("#") ? color.slice(1) : color;
  return `#${raw.slice(0, 6)}${toHex2(Math.max(0, Math.min(1, value)) * 255)}`;
}

export function cinematicPalette(theme: ThemePalette): CinematicPalette {
  return {
    boardBg: theme.boardBg,
    frame: theme.boardFrame,
    // The recess: a lit top-inner edge and a sunk bottom-inner edge, both from
    // the frame's own colour so the metal keeps the theme's temperature.
    frameRim: lighten(theme.boardFrameInner, 0.22),
    frameShadow: darken(theme.boardFrame, 0.55),
    frameBevel: theme.boardFrameBevel,
    frameCorner: theme.boardFrameCorner,
    emptyCell: theme.emptyCell,
    emptyCellBorder: theme.emptyCellBorder,
    // The gutter hairline sits between the empty-cell border and the board
    // panel, so the grid reads as etched into the recess rather than drawn on
    // top of it.
    gridLine: mix(theme.background.grid, theme.emptyCellBorder, 0.4),
    // Ambience and vignette are alpha-only by construction: at these opacities
    // a hue would tint the whole board, and the point is texture, not colour.
    ambience: alpha("#FFFFFF", 0.018),
    vignette: alpha("#000000", 0.45),
    breath: alpha(theme.accent, 0.05),
    rubbleFill: theme.rubbleFill,
    rubbleEdge: theme.rubbleEdge,
    rubbleFacet: theme.rubbleFacet,
    rubbleCrack: theme.rubbleCrack,
    rubbleFissure: theme.rubbleFissure,
    accent: theme.accent,
    danger: theme.timerCritical,
    timerNormal: theme.timerNormal,
    timerWarning: theme.timerWarning,
    timerCritical: theme.timerCritical,
    timerFrozen: theme.timerFrozen,
    badgeBg: theme.appBackground,
    onSurface: theme.onSurface,
    glow: theme.glow,
  };
}
