import { DashPathEffect, Group, RoundedRect } from "@shopify/react-native-skia";
import { memo } from "react";

import type { ScenePreview, SceneGeometry } from "../types";

/** The ghost of the piece under the finger.
 *
 *  Three states, and the distinction between them is never carried by colour
 *  alone: a valid ghost is a solid accent edge, an invalid one is the danger hue
 *  with a DASHED edge, and a conflict is the same dash over a heavier fill. The
 *  dash is the half of the signal a colour-blind player reads, and
 *  `docs/GAME_RULES.md` requires it — `blockSurface` already decides it, and
 *  this layer only obeys.
 *
 *  Preview cells are drawn above blocks and rubble deliberately. A conflict IS
 *  an overlap with an occupied cell, so the ghost has to be visible on top of
 *  whatever it collides with — that is the whole information content of the
 *  state. */
function PreviewLayerImpl({
  preview,
  geometry,
}: {
  preview: readonly ScenePreview[];
  geometry: SceneGeometry;
}) {
  const radius = geometry.cellRadius;

  return (
    <Group>
      {preview.map((cell) => {
        const { x, y, width, height } = cell.rect;
        const { surface } = cell;
        return (
          <Group key={`${cell.row},${cell.column}`}>
            <RoundedRect
              x={x}
              y={y}
              width={width}
              height={height}
              r={radius}
              color={surface.fill}
            />
            <RoundedRect
              x={x + surface.borderWidth / 2}
              y={y + surface.borderWidth / 2}
              width={width - surface.borderWidth}
              height={height - surface.borderWidth}
              r={radius}
              color={surface.edge}
              style="stroke"
              strokeWidth={surface.borderWidth}
            >
              {surface.dashed ? <DashPathEffect intervals={[4, 3]} /> : null}
            </RoundedRect>
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
export const PreviewLayer = memo(PreviewLayerImpl);
