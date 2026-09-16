import type { ThemePalette } from "./themes";

/** One renderer-neutral treatment for a predicted completed line. Row and
 * column lanes deliberately share it, so their translucent fills compound at
 * intersections without any per-cell special case. */
export type PreClearVisual = Readonly<{
  fill: string;
  edge: string;
  edgeWidth: number;
}>;

export const PRE_CLEAR_PULSE_MIN = 0.72;
export const PRE_CLEAR_PULSE_MS = 700;

function withAlpha(color: string, alpha: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}${alpha}` : color;
}

export function preClearVisual(theme: ThemePalette): PreClearVisual {
  return {
    // 0x80 ~= 50%; the shared pulse gently falls away from that peak without
    // impersonating the post-placement celebration.
    fill: withAlpha(theme.accent, "80"),
    edge: withAlpha(theme.accent, "A6"),
    edgeWidth: 1,
  };
}
