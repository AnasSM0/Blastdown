import type { CellPosition } from "./placement";

export type GameEvent =
  | { type: "piecePlaced"; handId: string; pieceId: string; cells: CellPosition[] }
  | { type: "linesCleared"; rows: number[]; columns: number[] }
  | { type: "pieceDefused"; pieceId: string; bonus: number; remainingTurns: number }
  | { type: "timerChanged"; pieceId: string; remainingTurns: number }
  | { type: "timerWarning"; pieceId: string; remainingTurns: number }
  | {
      type: "explosionStarted";
      explosionId: string;
      pieceId: string;
      /** Surviving cells of the expired timed piece immediately before the
       * explosion converted them to rubble. Presentation uses this committed
       * footprint for the blast origin instead of reconstructing piece rules. */
      sourceCells: CellPosition[];
    }
  | { type: "rubbleCreated"; explosionId: string; cells: CellPosition[] }
  | { type: "rubbleCleared"; cells: CellPosition[] }
  | { type: "scoreChanged"; delta: number; score: number }
  | { type: "comboChanged"; combo: number }
  | { type: "handRefilled"; handIds: string[] }
  | { type: "freezeActivated"; placementsRemaining: number }
  | { type: "freezeConsumed"; placementsRemaining: number }
  | { type: "defuseActivated"; pieceId: string }
  | { type: "reviveApplied" }
  | { type: "gameOver" };
