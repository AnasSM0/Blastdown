export type CellKind = "empty" | "timed" | "normal" | "rubble";

export type GridCell =
  | {
      kind: "empty";
    }
  | {
      kind: "timed";
      pieceInstanceId: string;
      colorId: string;
    }
  | {
      kind: "normal";
      colorId: string;
    }
  | {
      kind: "rubble";
      explosionId: string;
    };

export type ActiveTimedPiece = {
  id: string;
  shapeId: string;
  remainingTurns: number;
  placedOnTurn: number;
  colorId: string;
};

export type HandPiece = {
  handId: string;
  shapeId: string;
  colorId: string;
};

export type GameStatus =
  "ready" | "playing" | "paused" | "resolving" | "gameOver" | "awaitingRevive" | "finished";

export type GameState = {
  version: number;
  seed: string;
  rngState: number;
  turn: number;
  grid: GridCell[][];
  hand: HandPiece[];
  activeTimers: Record<string, ActiveTimedPiece>;
  score: number;
  combo: number;
  bestCombo: number;
  linesCleared: number;
  piecesPlaced: number;
  piecesDefused: number;
  explosions: number;
  rubbleCleared: number;
  freezeTurnsRemaining: number;
  rewardedFreezeUses: number;
  rewardedDefuseUses: number;
  reviveUsed: boolean;
  /** Count of hands generated so far; also the next refill's unique-id prefix. */
  handRefills: number;
  lastExplosionId?: string;
  status: GameStatus;
  startedAt: number;
  lastUpdatedAt: number;
};
