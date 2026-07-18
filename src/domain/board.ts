import type { GridCell } from "./gameTypes";

export const BOARD_SIZE = 8;

export function createEmptyBoard(): GridCell[][] {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, (): GridCell => ({ kind: "empty" })),
  );
}
