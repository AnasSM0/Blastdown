import { BlurMask, Group, Line, RoundedRect, vec } from "@shopify/react-native-skia";
import { memo } from "react";

import {
  CONTOUR_BOTTOM,
  CONTOUR_LEFT,
  CONTOUR_RIGHT,
  CONTOUR_TOP,
} from "../../../components/GridCell";
import { alpha, darken, lighten } from "../palette";
import type { CinematicPalette, SceneBlock, SceneGeometry } from "../types";

/** Placed blocks: the luminous beveled material the reference calls for.
 *
 *  Each block is five cheap draws rather than a filter stack — a glow halo, the
 *  solid body, a top-left bevel highlight, a bottom-right depth shadow, and the
 *  saturated outline. The order is the material: light from the top-left is what
 *  makes a flat rectangle read as a raised, chamfered tile, and it is the same
 *  light direction the board's recess uses, so blocks sit INSIDE the recess
 *  rather than floating over an unrelated surface.
 *
 *  Two things are deliberately not done. The halo is a blurred copy of the block
 *  itself rather than a per-cell blur filter — blurring sixty-four cells
 *  individually is the single most expensive thing a renderer like this can do,
 *  and it buys nothing a blurred rounded rect does not. And the hue is never
 *  changed by state: `docs/STYLE_GUIDE.md` keeps a block's colour identity
 *  across every variant, so "critical" arrives here as a heavier edge and a
 *  stronger glow, already resolved by `blockSurface`. */

/** Bevel and shadow inset, as a fraction of the cell. Small: this is a chamfer
 *  catching light, not a border. */
const BEVEL_RATIO = 0.14;

/** Bloom radius at the Reactor baseline, scaled by the theme's glow factor. */
const HALO_BLUR = 6;

/** A stable empty array, so the "no bloom" path allocates nothing per render. */
const EMPTY_BLOCKS: readonly SceneBlock[] = [];

/** The sheen, matching `BlockSurface`'s own band exactly (top 45%, 0.22
 *  opacity). Duplicated as constants rather than imported because the React
 *  Native version lives in a StyleSheet where the values are a percentage
 *  string and a style field; `__tests__/rendering/cinematicParity.test.ts` pins
 *  the two together so this cannot drift silently. */
const SHEEN_HEIGHT_RATIO = 0.45;
const SHEEN_OPACITY = 0.22;

function contourLines(
  block: SceneBlock,
  geometry: SceneGeometry,
): { p1: { x: number; y: number }; p2: { x: number; y: number } }[] {
  const mask = block.contourMask;
  if (mask === undefined) {
    return [];
  }
  const { x, y, width, height } = block.rect;
  // Inset by half the stroke so the contour sits ON the block's edge rather than
  // half-outside it, where it would overlap the neighbouring gutter hairline.
  const inset = 1;
  const lines = [];
  if (mask & CONTOUR_TOP) {
    lines.push({ p1: { x, y: y + inset }, p2: { x: x + width, y: y + inset } });
  }
  if (mask & CONTOUR_RIGHT) {
    lines.push({ p1: { x: x + width - inset, y }, p2: { x: x + width - inset, y: y + height } });
  }
  if (mask & CONTOUR_BOTTOM) {
    lines.push({ p1: { x, y: y + height - inset }, p2: { x: x + width, y: y + height - inset } });
  }
  if (mask & CONTOUR_LEFT) {
    lines.push({ p1: { x: x + inset, y }, p2: { x: x + inset, y: y + height } });
  }
  return lines;
}

function BlocksLayerImpl({
  blocks,
  geometry,
  palette,
}: {
  blocks: readonly SceneBlock[];
  geometry: SceneGeometry;
  palette: CinematicPalette;
}) {
  const radius = geometry.cellRadius;
  const bevel = Math.max(1, geometry.cellSize * BEVEL_RATIO);
  // One blur radius for the whole bloom layer. Per-block radii would force the
  // halos back into separate paints and undo the point of grouping them.
  const halo = HALO_BLUR * palette.glow;
  const glowing = halo > 0 ? blocks.filter((block) => block.surface.glow) : EMPTY_BLOCKS;

  return (
    <Group>
      {/* THE BLOOM LAYER, and the single most important line in this renderer's
          performance story.

          Every block used to carry its own `<BlurMask>`. A blur mask is an
          offscreen render pass, so a full board was up to sixty-four offscreen
          passes per frame — on a mid-range Android GPU that is the difference
          between a smooth board and a visibly laggy one. The comment that used
          to sit here claimed the halo was "a blurred copy of the block rather
          than a per-cell blur filter", which was not a distinction: it was a
          per-cell blur filter.

          Grouping the halos puts one blur on one paint covering all of them, so
          the cost stops scaling with the number of blocks. The look is very
          close — the halos bleed into each other slightly where blocks touch,
          which if anything reads better for a piece made of adjacent cells. */}
      {glowing.length > 0 ? (
        <Group>
          <BlurMask blur={halo} style="outer" />
          {glowing.map((block) => (
            <RoundedRect
              key={`halo-${block.row},${block.column}`}
              x={block.rect.x}
              y={block.rect.y}
              width={block.rect.width}
              height={block.rect.height}
              r={radius}
              color={alpha(block.accent, 0.45)}
            />
          ))}
        </Group>
      ) : null}

      {blocks.map((block) => {
        const { x, y, width, height } = block.rect;
        const { surface } = block;
        return (
          <Group key={`${block.row},${block.column}`} opacity={surface.opacity}>
            <RoundedRect
              x={x}
              y={y}
              width={width}
              height={height}
              r={radius}
              color={surface.fill}
            />

            {/* The sheen, carried over from the React Native block so both
                renderers share one material family: a soft lit band across the
                top 45% at low opacity. The bevel below is the cinematic
                addition on top of it, not a replacement for it. */}
            {surface.highlight ? (
              <Group opacity={SHEEN_OPACITY}>
                <RoundedRect
                  x={x}
                  y={y}
                  width={width}
                  height={height * SHEEN_HEIGHT_RATIO}
                  r={radius}
                  color={surface.highlight}
                />
              </Group>
            ) : null}

            {/* Top-left bevel: a bright hairline pair along the two lit edges. */}
            {surface.highlight ? (
              <Group>
                <Line
                  p1={vec(x + radius, y + bevel * 0.5)}
                  p2={vec(x + width - radius, y + bevel * 0.5)}
                  color={alpha(lighten(block.accent, 0.5), 0.55)}
                  strokeWidth={Math.max(1, bevel * 0.5)}
                />
                <Line
                  p1={vec(x + bevel * 0.5, y + radius)}
                  p2={vec(x + bevel * 0.5, y + height - radius)}
                  color={alpha(lighten(block.accent, 0.35), 0.35)}
                  strokeWidth={Math.max(1, bevel * 0.4)}
                />
              </Group>
            ) : null}

            {/* Bottom-right depth: the same two edges in shadow. */}
            <Line
              p1={vec(x + radius, y + height - bevel * 0.4)}
              p2={vec(x + width - radius, y + height - bevel * 0.4)}
              color={alpha(darken(block.accent, 0.75), 0.5)}
              strokeWidth={Math.max(1, bevel * 0.4)}
            />
            <Line
              p1={vec(x + width - bevel * 0.4, y + radius)}
              p2={vec(x + width - bevel * 0.4, y + height - radius)}
              color={alpha(darken(block.accent, 0.7), 0.4)}
              strokeWidth={Math.max(1, bevel * 0.35)}
            />

            {/* Saturated outline. */}
            <RoundedRect
              x={x + surface.borderWidth / 2}
              y={y + surface.borderWidth / 2}
              width={width - surface.borderWidth}
              height={height - surface.borderWidth}
              r={radius}
              color={surface.edge}
              style="stroke"
              strokeWidth={surface.borderWidth}
            />

            {/* Piece silhouette: only the sides facing outside the timed piece,
                so a multi-cell piece reads as one bounded group and its interior
                seams stay open. */}
            {contourLines(block, geometry).map((line, index) => (
              <Line
                key={index}
                p1={vec(line.p1.x, line.p1.y)}
                p2={vec(line.p2.x, line.p2.y)}
                color={block.accent}
                strokeWidth={2}
              />
            ))}

            {/* Rewarded-defuse target ring. */}
            {block.highlighted ? (
              <>
                <RoundedRect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  r={radius}
                  color={alpha(palette.accent, 0.2)}
                />
                <RoundedRect
                  x={x + 1}
                  y={y + 1}
                  width={width - 2}
                  height={height - 2}
                  r={radius}
                  color={palette.accent}
                  style="stroke"
                  strokeWidth={2}
                />
              </>
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
export const BlocksLayer = memo(BlocksLayerImpl);
