import type { GameState } from "./gameTypes";
import type { GameEvent } from "./events";
import { createEmptyBoard } from "./board";
import { createInitialRngState } from "./seededRandom";
import { generateHand } from "./handGeneration";
import { getShapeById } from "./shapes";
import { applyPlacement, isValidPlacement, type CellPosition } from "./placement";
import { clearLines, detectCompletedLines } from "./lineClearing";
import { calculateTurnScore } from "./scoring";
import { isGameOver } from "./gameOver";

export const GAME_STATE_VERSION = 1;

export type TurnResult = {
  ok: boolean;
  state: GameState;
  events: GameEvent[];
};

export function createInitialGameState(seed: string, now: number): GameState {
  const rngState = createInitialRngState(seed);
  const { hand, nextRngState } = generateHand(rngState, { refillIndex: 0 });

  return {
    version: GAME_STATE_VERSION,
    seed,
    rngState: nextRngState,
    turn: 0,
    grid: createEmptyBoard(),
    hand,
    activeTimers: {},
    score: 0,
    combo: 0,
    bestCombo: 0,
    linesCleared: 0,
    piecesPlaced: 0,
    piecesDefused: 0,
    explosions: 0,
    rubbleCleared: 0,
    freezeTurnsRemaining: 0,
    rewardedFreezeUses: 0,
    rewardedDefuseUses: 0,
    reviveUsed: false,
    handRefills: 1,
    status: "playing",
    startedAt: now,
    lastUpdatedAt: now,
  };
}

function reject(state: GameState): TurnResult {
  return { ok: false, state, events: [] };
}

export function placePiece(
  state: GameState,
  handId: string,
  origin: CellPosition,
  now: number,
): TurnResult {
  if (state.status !== "playing") {
    return reject(state);
  }

  const handPiece = state.hand.find((piece) => piece.handId === handId);
  if (!handPiece) {
    return reject(state);
  }

  const shape = getShapeById(handPiece.shapeId);
  if (!shape) {
    return reject(state);
  }

  if (!isValidPlacement(state.grid, shape, origin)) {
    return reject(state);
  }

  const events: GameEvent[] = [];

  // Place the new piece.
  const placedCells: CellPosition[] = shape.cells.map((cell) => ({
    row: origin.row + cell.row,
    column: origin.column + cell.column,
  }));
  let grid = applyPlacement(state.grid, shape, origin, handPiece.colorId);
  events.push({ type: "piecePlaced", handId, cells: placedCells });

  // Detect and clear completed lines.
  const { rows, columns } = detectCompletedLines(grid);
  const clearedLineCount = rows.length + columns.length;
  if (clearedLineCount > 0) {
    grid = clearLines(grid, rows, columns);
    events.push({ type: "linesCleared", rows, columns });
  }

  // Score and combo.
  const { scoreDelta, nextCombo } = calculateTurnScore({
    cellsPlaced: shape.cells.length,
    linesCleared: clearedLineCount,
    previousCombo: state.combo,
  });
  const score = state.score + scoreDelta;
  events.push({ type: "scoreChanged", delta: scoreDelta, score });
  if (nextCombo !== state.combo) {
    events.push({ type: "comboChanged", combo: nextCombo });
  }

  // Consume the used piece; refill if the hand is exhausted.
  let hand = state.hand.filter((piece) => piece.handId !== handId);
  let rngState = state.rngState;
  let handRefills = state.handRefills;
  if (hand.length === 0) {
    const refill = generateHand(rngState, { refillIndex: handRefills });
    hand = refill.hand;
    rngState = refill.nextRngState;
    handRefills += 1;
    events.push({
      type: "handRefilled",
      handIds: hand.map((piece) => piece.handId),
    });
  }

  const nextState: GameState = {
    ...state,
    grid,
    hand,
    rngState,
    handRefills,
    score,
    combo: nextCombo,
    bestCombo: Math.max(state.bestCombo, nextCombo),
    turn: state.turn + 1,
    piecesPlaced: state.piecesPlaced + 1,
    linesCleared: state.linesCleared + clearedLineCount,
    lastUpdatedAt: now,
  };

  // Check whether any current hand piece can fit.
  if (isGameOver(nextState.grid, nextState.hand)) {
    nextState.status = "gameOver";
    events.push({ type: "gameOver" });
  }

  return { ok: true, state: nextState, events };
}
