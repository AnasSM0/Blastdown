import { Group, Line, RoundedRect, vec } from "@shopify/react-native-skia";
import { memo } from "react";

import { alpha } from "../palette";
import type { CinematicPalette, SceneGeometry, SceneRubble } from "../types";

/** Rubble: the authoritative damage a timer expiry leaves behind.
 *
 *  Rubble is not decoration. `docs/GAME_RULES.md` makes it a cell state that
 *  blocks placement and clears only through a completed line, and
 *  `BUILD_SPEC.md` §6.13 requires it stay "clearly different from normal
 *  pieces". So it is drawn with no accent hue, no glow and no bevel — the three
 *  things every block has — which distinguishes it by material rather than by
 *  colour, and therefore also for a player who cannot separate the hues.
 *
 *  The crack layout comes from `getRubbleGeometry(row, column)`, the same
 *  deterministic preset table the React Native renderer uses: a given cell
 *  cracks identically in both renderers, every frame, and across sessions. That
 *  determinism is what stops a board of rubble shimmering as it redraws. */
function RubbleLayerImpl({
  rubble,
  geometry,
  palette,
}: {
  rubble: readonly SceneRubble[];
  geometry: SceneGeometry;
  palette: CinematicPalette;
}) {
  const radius = geometry.cellRadius;

  return (
    <Group>
      {rubble.map((cell) => {
        const { x, y, width, height } = cell.rect;
        return (
          <Group key={`${cell.row},${cell.column}`}>
            <RoundedRect
              x={x}
              y={y}
              width={width}
              height={height}
              r={radius}
              color={palette.rubbleFill}
            />

            {/* Broken-surface facets: flat angular patches, slightly lighter
                than the body, that keep the tile from reading as a plain
                rounded square. */}
            {cell.geometry.facets.map((facet, index) => (
              <RoundedRect
                key={`facet-${index}`}
                x={x + (facet.leftPct / 100) * width}
                y={y + (facet.topPct / 100) * height}
                width={(facet.widthPct / 100) * width}
                height={(facet.heightPct / 100) * height}
                r={1}
                color={alpha(palette.rubbleFacet, 0.55)}
                origin={vec(x + width / 2, y + height / 2)}
                transform={[{ rotate: (facet.rotateDeg * Math.PI) / 180 }]}
              />
            ))}

            {/* Cracks. Exactly one per layout is a "fissure" carrying the warm
                ember seam — the only warmth on the tile, and the cue that reads
                as recent damage rather than as texture. */}
            {cell.geometry.cracks.map((crack, index) => {
              const cx = x + (crack.leftPct / 100) * width;
              const cy = y + (crack.topPct / 100) * height;
              const length = (crack.lengthPct / 100) * width;
              const angle = (crack.rotateDeg * Math.PI) / 180;
              const end = vec(cx + Math.cos(angle) * length, cy + Math.sin(angle) * length);
              return (
                <Line
                  key={`crack-${index}`}
                  p1={vec(cx, cy)}
                  p2={end}
                  color={crack.fissure ? palette.rubbleFissure : palette.rubbleCrack}
                  strokeWidth={crack.fissure ? 1.5 : 1}
                />
              );
            })}

            <RoundedRect
              x={x + 0.5}
              y={y + 0.5}
              width={width - 1}
              height={height - 1}
              r={radius}
              color={palette.rubbleEdge}
              style="stroke"
              strokeWidth={1}
            />
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
export const RubbleLayer = memo(RubbleLayerImpl);
