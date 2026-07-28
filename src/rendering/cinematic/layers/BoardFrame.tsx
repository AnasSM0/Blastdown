import { Picture, Skia, createPicture, PaintStyle } from "@shopify/react-native-skia";
import { useMemo } from "react";

import { boardDrawCommands } from "../boardPicture";
import type { CinematicPalette, SceneGeometry } from "../types";

/** The cached static board: frame, recess, grid, empty cells and ambience.
 *
 *  Roughly two hundred draw calls collapse into one `Picture`, rebuilt only when
 *  the board is resized or the theme changes. Everything a turn can alter is
 *  drawn over this by the dynamic layers, so placing a piece costs nothing here.
 *
 *  The command list this replays is built by `boardDrawCommands`, a pure
 *  function — see its doc comment for why the drawing is expressed as data
 *  first. The loop below is the only part that cannot be tested off a device,
 *  and it is deliberately the dullest code in the renderer: no conditionals
 *  beyond the command kind, no geometry, no colour decisions. */
export function BoardFrame({
  geometry,
  palette,
}: {
  geometry: SceneGeometry;
  palette: CinematicPalette;
}) {
  const picture = useMemo(() => {
    const commands = boardDrawCommands(geometry, palette);
    return createPicture((canvas) => {
      const paint = Skia.Paint();
      paint.setAntiAlias(true);
      for (const command of commands) {
        paint.setColor(Skia.Color(command.color));
        if (command.op === "line") {
          paint.setStyle(PaintStyle.Stroke);
          paint.setStrokeWidth(command.width);
          canvas.drawLine(command.x1, command.y1, command.x2, command.y2, paint);
          continue;
        }
        const filled = command.style === "fill";
        paint.setStyle(filled ? PaintStyle.Fill : PaintStyle.Stroke);
        paint.setStrokeWidth(filled ? 0 : (command.strokeWidth ?? 1));
        const rect = Skia.XYWHRect(
          command.rect.x,
          command.rect.y,
          command.rect.width,
          command.rect.height,
        );
        if (command.op === "rrect") {
          canvas.drawRRect(Skia.RRectXY(rect, command.radius, command.radius), paint);
        } else {
          canvas.drawRect(rect, paint);
        }
      }
    });
    // Rebuilt on geometry or palette identity only. Both are stable across a
    // turn: geometry changes on resize, palette on a theme switch.
  }, [geometry, palette]);

  return <Picture picture={picture} />;
}
