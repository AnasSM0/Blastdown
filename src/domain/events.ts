import type { CellPosition } from "./placement";

export type GameEvent =
  | { type: "piecePlaced"; handId: string; pieceId: string; cells: CellPosition[] }
  | { type: "linesCleared"; rows: number[]; columns: number[] }
  | { type: "pieceDefused"; pieceId: string; bonus: number }
  | { type: "timerChanged"; pieceId: string; remainingTurns: number }
  | { type: "timerWarning"; pieceId: string; remainingTurns: number }
  | { type: "scoreChanged"; delta: number; score: number }
  | { type: "comboChanged"; combo: number }
  | { type: "handRefilled"; handIds: string[] }
  | { type: "gameOver" };
