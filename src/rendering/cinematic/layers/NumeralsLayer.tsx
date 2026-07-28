import {
  BlurMask,
  Circle,
  DashPathEffect,
  Group,
  Text,
  type SkFont,
} from "@shopify/react-native-skia";

import { rectCenter } from "../geometry";
import { alpha } from "../palette";
import type { CinematicPalette, SceneNumeral } from "../types";

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
export function NumeralsLayer({
  numerals,
  palette,
  font,
}: {
  numerals: readonly SceneNumeral[];
  palette: CinematicPalette;
  font: SkFont | null;
}) {
  return (
    <Group>
      {numerals.map((numeral) => {
        const center = rectCenter(numeral.rect);
        const outer = numeral.rect.width / 2;
        const { visual } = numeral;
        const label = String(numeral.value);
        // The glow follows the badge's own intensity so an urgent timer reads
        // hotter than a calm one without changing the numeral's legibility.
        const halo = (visual.glow ? 8 : 0) * palette.glow;

        return (
          <Group key={numeral.pieceId}>
            {halo > 0 ? (
              <Circle cx={center.x} cy={center.y} r={outer} color={alpha(visual.ringColor, 0.4)}>
                <BlurMask blur={halo} style="outer" />
              </Circle>
            ) : null}

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
              <Text
                x={center.x - font.measureText(label).width / 2}
                // `measureText` returns a rect whose y is the ascent (negative,
                // above the baseline). Offsetting the baseline by half its
                // height centres the glyph optically rather than centring its
                // box, which for tabular digits is the difference between
                // "centred" and "looks centred".
                y={center.y - font.measureText(label).y / 2}
                text={label}
                font={font}
                color={visual.numeralColor}
              />
            ) : null}
          </Group>
        );
      })}
    </Group>
  );
}
