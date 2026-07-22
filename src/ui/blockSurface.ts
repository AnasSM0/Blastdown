import type { ViewStyle } from "react-native";

import { glowFor, type ThemePalette } from "./themes";

/** The distinct presentation states a block surface can take (P1-4). All keep
 *  the block's domain color identity — a variant changes intensity/depth, never
 *  the hue — except the preview variants, whose accent the caller supplies. */
export type BlockVariant =
  | "normal" // a placed block on the board
  | "tray" // a block sitting in the piece tray
  | "selected" // the currently selected tray piece
  | "critical" // a timed block whose countdown is urgent (color preserved)
  | "disabled" // a consumed/dragged block: no glow, reduced priority
  | "previewValid" // a placeable ghost of the piece under the finger
  | "previewInvalid" // an unplaceable ghost — danger + a non-color (dashed) cue
  | "previewConflict"; // an overlap with an occupied cell — stronger danger fill

/** A flattened description of a block surface: solid style values a component
 *  composes into its cell View. Centralizing the alpha math here keeps hex
 *  values out of the components (theme tokens + one place that tints them). */
export type BlockSurfaceStyle = {
  /** Dark translucent, theme-colored fill. */
  fill: string;
  /** Saturated outer edge (border) color. */
  edge: string;
  borderWidth: number;
  /** Brighter inner/upper highlight color, or null when the state omits it. */
  highlight: string | null;
  /** Restrained neon glow, or null for states that lose glow (disabled). */
  glow: ViewStyle | null;
  /** Overall opacity — <1 only for the de-emphasized disabled state. */
  opacity: number;
  /** When true the edge is dashed — the non-color cue for an invalid preview. */
  dashed: boolean;
};

/** Append an 8-bit alpha (2 hex digits) to a 6-digit hex color. */
function withAlpha(hex6: string, alpha2: string): string {
  return `${hex6}${alpha2}`;
}

/** Build the layered "energy tile" surface for a block in a given state. Pure
 *  and synchronous, so every state is unit-testable without mounting anything.
 *  `accent` is the block's themed hue (`blockColor(theme, colorId)`), or, for
 *  the preview variants, the caller-chosen accent/danger color. */
export function blockSurface(
  theme: ThemePalette,
  accent: string,
  variant: BlockVariant,
): BlockSurfaceStyle {
  switch (variant) {
    case "normal":
      return {
        fill: withAlpha(accent, "2E"),
        edge: accent,
        borderWidth: 1.5,
        highlight: withAlpha(accent, "66"),
        glow: glowFor(theme, accent, "low"),
        opacity: 1,
        dashed: false,
      };
    case "tray":
      return {
        fill: withAlpha(accent, "3A"),
        edge: accent,
        borderWidth: 1,
        highlight: withAlpha(accent, "66"),
        glow: null,
        opacity: 1,
        dashed: false,
      };
    case "selected":
      return {
        fill: withAlpha(accent, "40"),
        edge: accent,
        borderWidth: 2,
        highlight: withAlpha(accent, "88"),
        glow: glowFor(theme, accent, "high"),
        opacity: 1,
        dashed: false,
      };
    case "critical":
      // Color is preserved; the danger read comes from a thicker saturated
      // edge, a stronger glow, and a brighter inner highlight — never a recolor.
      return {
        fill: withAlpha(accent, "33"),
        edge: accent,
        borderWidth: 2,
        highlight: withAlpha(accent, "AA"),
        glow: glowFor(theme, accent, "high"),
        opacity: 1,
        dashed: false,
      };
    case "disabled":
      return {
        fill: withAlpha(accent, "14"),
        edge: withAlpha(accent, "80"),
        borderWidth: 1,
        highlight: null,
        glow: null,
        opacity: 0.5,
        dashed: false,
      };
    case "previewValid":
      return {
        fill: withAlpha(accent, "26"),
        edge: accent,
        borderWidth: 1.5,
        highlight: null,
        glow: null,
        opacity: 1,
        dashed: false,
      };
    case "previewInvalid":
      return {
        fill: withAlpha(accent, "1A"),
        edge: accent,
        borderWidth: 1.5,
        highlight: null,
        glow: null,
        opacity: 1,
        dashed: true,
      };
    case "previewConflict":
      return {
        fill: withAlpha(accent, "4D"),
        edge: accent,
        borderWidth: 1.5,
        highlight: null,
        glow: null,
        opacity: 1,
        dashed: true,
      };
  }
}
