import type { GridCell, HandPiece } from "./gameTypes";
import { isValidPlacement } from "./placement";
import { getShapeById, type ShapeDefinition } from "./shapes";

export function canPlaceShapeAnywhere(
  grid: readonly (readonly GridCell[])[],
  shape: ShapeDefinition,
): boolean {
  const size = grid.length;
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      if (isValidPlacement(grid, shape, { row, column })) {
        return true;
      }
    }
  }
  return false;
}

export function isGameOver(
  grid: readonly (readonly GridCell[])[],
  hand: readonly HandPiece[],
): boolean {
  return hand.every((piece) => {
    const shape = getShapeById(piece.shapeId);
    return !shape || !canPlaceShapeAnywhere(grid, shape);
  });
}
