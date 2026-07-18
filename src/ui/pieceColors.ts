import { colors } from "./theme";

/** Maps domain colorIds (src/config/balance.ts PIECE_COLOR_IDS) to theme
 *  hex values. Presentation-only — the domain never sees hex colors. */
const PIECE_COLOR_MAP: Record<string, string> = {
  cyan: colors.cyanBlock,
  purple: colors.purpleBlock,
  amber: colors.amberBlock,
};

export function pieceColor(colorId: string): string {
  return PIECE_COLOR_MAP[colorId] ?? colors.outline;
}
