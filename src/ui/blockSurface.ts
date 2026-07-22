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
  /** The block body color. Solid (opaque) for placed/tray/selected/critical
   *  blocks so the hue reads over any backing; translucent only for the ghostly
   *  preview variants and the de-emphasized disabled state. */
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

/** The opaque dark body every placed/tray block is mixed toward, so a block's
 *  color reads the same regardless of what sits behind it (dark board vs the
 *  lighter tray panel). Deep near-black navy — theme-neutral, since the visible
 *  hue always comes from the block's own accent. */
const BLOCK_BODY_DARK = "#05070E";

function channel(hex6: string, offset: number): number {
  return parseInt(hex6.slice(offset, offset + 2), 16);
}

function toHex2(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, "0");
}

/** Linear blend of two 6-digit hex colors (`t` = 0 → a, 1 → b). Returns an
 *  opaque `#RRGGBB`. Used to build a solid, backing-independent block body from
 *  the accent, replacing the translucent tint that vanished against the dark
 *  board. */
function mix(a: string, b: string, t: number): string {
  const ai = a.startsWith("#") ? a.slice(1) : a;
  const bi = b.startsWith("#") ? b.slice(1) : b;
  const r = channel(ai, 0) + (channel(bi, 0) - channel(ai, 0)) * t;
  const g = channel(ai, 2) + (channel(bi, 2) - channel(ai, 2)) * t;
  const bl = channel(ai, 4) + (channel(bi, 4) - channel(ai, 4)) * t;
  return `#${toHex2(r)}${toHex2(g)}${toHex2(bl)}`;
}

/** Opaque, clearly-colored block body: the accent mixed toward the dark body by
 *  `darken` (0 = full accent, 1 = fully dark). */
function body(accent: string, darken: number): string {
  return mix(accent, BLOCK_BODY_DARK, darken);
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
      // A solid, clearly-colored body (opaque so it reads over the dark board,
      // not a faint tint that sinks into it), a saturated edge, an inner
      // highlight, and a restrained glow.
      return {
        fill: body(accent, 0.42),
        edge: accent,
        borderWidth: 1.5,
        highlight: withAlpha(accent, "66"),
        glow: glowFor(theme, accent, "low"),
        opacity: 1,
        dashed: false,
      };
    case "tray":
      // Same solid material as a placed block so the tray and board read as one
      // family; the board keeps its glow, the tray piece does not.
      return {
        fill: body(accent, 0.42),
        edge: accent,
        borderWidth: 1,
        highlight: withAlpha(accent, "66"),
        glow: null,
        opacity: 1,
        dashed: false,
      };
    case "selected":
      return {
        fill: body(accent, 0.3),
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
      // The body stays the same solid family, a touch brighter than normal.
      return {
        fill: body(accent, 0.34),
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
