import type { CellPosition } from "./placement";

export type GameEvent =
  | { type: "piecePlaced"; handId: string; cells: CellPosition[] }
  | { type: "linesCleared"; rows: number[]; columns: number[] }
  | { type: "scoreChanged"; delta: number; score: number }
  | { type: "comboChanged"; combo: number }
  | { type: "handRefilled"; handIds: string[] }
  | { type: "gameOver" };
