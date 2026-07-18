import type { ActiveTimedPiece, GameState } from "./gameTypes";
import type { GameEvent } from "./events";
import { createEmptyBoard } from "./board";
import { createInitialRngState } from "./seededRandom";
import { generateHand } from "./handGeneration";
import { getShapeById } from "./shapes";
import { applyPlacement, isValidPlacement, type CellPosition } from "./placement";
import { clearLines, detectCompletedLines } from "./lineClearing";
import { calculateTurnScore } from "./scoring";
import { isGameOver } from "./gameOver";
import { countSurvivingCells, startingCountdownForTurn } from "./timers";
import {
  DEFUSE_BONUS_BASE,
  DEFUSE_BONUS_PER_REMAINING_TURN,
  TIMER_WARNING_VALUES,
} from "../config/balance";

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
  const turnNumber = state.turn + 1;

  // Place the new piece as a timed piece instance.
  const pieceId = `piece-${turnNumber}`;
  const placedCells: CellPosition[] = shape.cells.map((cell) => ({
    row: origin.row + cell.row,
    column: origin.column + cell.column,
  }));
  let grid = applyPlacement(state.grid, shape, origin, handPiece.colorId, pieceId);
  events.push({ type: "piecePlaced", handId, pieceId, cells: placedCells });

  let activeTimers: Record<string, ActiveTimedPiece> = {
    ...state.activeTimers,
    [pieceId]: {
      id: pieceId,
      shapeId: shape.id,
      remainingTurns: startingCountdownForTurn(turnNumber),
      placedOnTurn: turnNumber,
      colorId: handPiece.colorId,
    },
  };

  // Detect and clear completed lines.
  const { rows, columns } = detectCompletedLines(grid);
  const clearedLineCount = rows.length + columns.length;
  if (clearedLineCount > 0) {
    grid = clearLines(grid, rows, columns);
    events.push({ type: "linesCleared", rows, columns });
  }

  // Identify fully cleared timed pieces and award defuse bonuses
  // before any timer decrement, so a piece at 1 can be saved this turn.
  let defuseBonusTotal = 0;
  let piecesDefusedThisTurn = 0;
  if (clearedLineCount > 0) {
    for (const timer of Object.values(activeTimers)) {
      if (countSurvivingCells(grid, timer.id) === 0) {
        const bonus = DEFUSE_BONUS_BASE + DEFUSE_BONUS_PER_REMAINING_TURN * timer.remainingTurns;
        defuseBonusTotal += bonus;
        piecesDefusedThisTurn += 1;
        events.push({ type: "pieceDefused", pieceId: timer.id, bonus });
        activeTimers = Object.fromEntries(
          Object.entries(activeTimers).filter(([id]) => id !== timer.id),
        );
      }
    }
  }

  // Decrement timers that existed before this placement (never the new piece).
  const decremented: Record<string, ActiveTimedPiece> = {};
  for (const [id, timer] of Object.entries(activeTimers)) {
    if (id === pieceId) {
      decremented[id] = timer;
      continue;
    }
    const remainingTurns = timer.remainingTurns - 1;
    decremented[id] = { ...timer, remainingTurns };
    events.push({ type: "timerChanged", pieceId: id, remainingTurns });
    if (TIMER_WARNING_VALUES.includes(remainingTurns)) {
      events.push({ type: "timerWarning", pieceId: id, remainingTurns });
    }
  }
  activeTimers = decremented;

  // Score and combo.
  const { scoreDelta, nextCombo } = calculateTurnScore({
    cellsPlaced: shape.cells.length,
    linesCleared: clearedLineCount,
    previousCombo: state.combo,
  });
  const totalScoreDelta = scoreDelta + defuseBonusTotal;
  const score = state.score + totalScoreDelta;
  events.push({ type: "scoreChanged", delta: totalScoreDelta, score });
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
    activeTimers,
    score,
    combo: nextCombo,
    bestCombo: Math.max(state.bestCombo, nextCombo),
    turn: turnNumber,
    piecesPlaced: state.piecesPlaced + 1,
    piecesDefused: state.piecesDefused + piecesDefusedThisTurn,
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
