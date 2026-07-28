import {
  BlurMask,
  Circle,
  DashPathEffect,
  Group,
  Text,
  type SkFont,
} from "@shopify/react-native-skia";
import { memo } from "react";

import { rectCenter } from "../geometry";
import { alpha } from "../palette";
import type { CinematicPalette, SceneNumeral } from "../types";

/** One drawn countdown.
 *
 *  Split out so `measureText` runs ONCE per numeral rather than twice — the
 *  previous version called it for the x position and again for the baseline,
 *  and text measurement is one of the more expensive things Skia does. */
function Numeral({
  label,
  font,
  center,
  color,
}: {
  label: string;
  font: SkFont;
  center: { x: number; y: number };
  color: string;
}) {
  const bounds = font.measureText(label);

  // `measureText` returns a rect whose y is the ascent (negative, above the
  // baseline). Offsetting the baseline by half its height centres the glyph
  // optically rather than centring its box, which for tabular digits is the
  // difference between "centred" and "looks centred".
  return (
    <Text
      x={center.x - bounds.width / 2}
      y={center.y - bounds.y / 2}
      text={label}
      font={font}
      color={color}
    />
  );
}

/** Bloom radius at the Reactor baseline, scaled by the theme's glow factor. */
const BADGE_BLUR = 8;

/** Timer badges and their numerals.
 *
 *  The numeral is the point. `docs/GAME_RULES.md` is explicit that a countdown
 *  must never be signalled by colour alone — the number is always shown — so the
 *  ring's colour, weight, dash and size are emphasis layered onto information
 *  that is already legible without any of them. `getBadgeVisual` resolves all
 *  four, the same call the React Native badge makes, so the states stay
 *  distinguishable by at least one non-colour attribute in both renderers.
 *
 *  `font` may be null, and that case is handled by the caller rather than here:
 *  a Skia font is loaded asynchronously, and a board that drew rings with no
 *  digits inside them would be showing a timer state while hiding the timer.
 *  `CinematicBoard` watches for it and falls back to real text views. */
function NumeralsLayerImpl({
  numerals,
  palette,
  font,
}: {
  numerals: readonly SceneNumeral[];
  palette: CinematicPalette;
  font: SkFont | null;
}) {
  // Grouped bloom, for the same reason the block layer groups its own: a blur
  // per badge is a render pass per badge. There are fewer badges than blocks,
  // but they are live on exactly the turns the board is busiest.
  const glowing = numerals.filter((numeral) => numeral.visual.glow);

  return (
    <Group>
      {glowing.length > 0 ? (
        <Group>
          <BlurMask blur={BADGE_BLUR * palette.glow} style="outer" />
          {glowing.map((numeral) => {
            const center = rectCenter(numeral.rect);
            return (
              <Circle
                key={`halo-${numeral.pieceId}`}
                cx={center.x}
                cy={center.y}
                r={numeral.rect.width / 2}
                color={alpha(numeral.visual.ringColor, 0.4)}
              />
            );
          })}
        </Group>
      ) : null}

      {numerals.map((numeral) => {
        const center = rectCenter(numeral.rect);
        const outer = numeral.rect.width / 2;
        const { visual } = numeral;
        const label = String(numeral.value);

        return (
          <Group key={numeral.pieceId}>
            {/* An opaque interior, so the numeral is read against a flat dark
                disc rather than against whatever block sits beneath it. */}
            <Circle cx={center.x} cy={center.y} r={outer} color={palette.badgeBg} />

            <Circle
              cx={center.x}
              cy={center.y}
              r={outer - visual.ringWidth / 2}
              color={visual.ringColor}
              style="stroke"
              strokeWidth={visual.ringWidth}
            >
              {/* The frozen state's held/paused cue. */}
              {visual.dashed ? <DashPathEffect intervals={[3, 3]} /> : null}
            </Circle>

            {font ? (
              <Numeral label={label} font={font} center={center} color={visual.numeralColor} />
            ) : null}
          </Group>
        );
      })}
    </Group>
  );
}

/** Memoized. Every prop is either a primitive or an array whose identity the
 *  scene adapter deliberately preserves, so a change that does not touch this
 *  layer costs one shallow comparison instead of a re-render and a Skia
 *  reconciliation of every node beneath it.
 *
 *  This is what makes the board/preview split pay off: dragging a piece rebuilds
 *  only the preview array, and the block, rubble and numeral layers all skip. */
export const NumeralsLayer = memo(NumeralsLayerImpl);
