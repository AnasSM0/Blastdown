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
import { resolveExpirations } from "./explosions";
import {
  DEFUSE_BONUS_BASE,
  DEFUSE_BONUS_PER_REMAINING_TURN,
  EXPLOSION_SCORE_PENALTY,
  FREEZE_PLACEMENTS,
  MAX_REWARDED_DEFUSES_PER_RUN,
  MAX_REWARDED_FREEZES_PER_RUN,
  REVIVE_HAND_CATEGORIES,
  REVIVE_TIMER_BONUS,
  REVIVE_TIMER_CAP,
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

  // Detect and clear completed lines, tracking rubble removed by the clear.
  const { rows, columns } = detectCompletedLines(grid);
  const clearedLineCount = rows.length + columns.length;
  let rubbleClearedThisTurn = 0;
  if (clearedLineCount > 0) {
    const rowSet = new Set(rows);
    const columnSet = new Set(columns);
    const clearedRubbleCells: CellPosition[] = [];
    for (let row = 0; row < grid.length; row++) {
      for (let column = 0; column < grid.length; column++) {
        if ((rowSet.has(row) || columnSet.has(column)) && grid[row][column].kind === "rubble") {
          clearedRubbleCells.push({ row, column });
        }
      }
    }
    grid = clearLines(grid, rows, columns);
    events.push({ type: "linesCleared", rows, columns });
    if (clearedRubbleCells.length > 0) {
      rubbleClearedThisTurn = clearedRubbleCells.length;
      events.push({ type: "rubbleCleared", cells: clearedRubbleCells });
    }
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

  // Decrement timers that existed before this placement (never the new
  // piece). An active freeze skips the decrement and consumes one freeze
  // placement instead (BUILD_SPEC.md §6.10 step 9).
  let freezeTurnsRemaining = state.freezeTurnsRemaining;
  if (freezeTurnsRemaining > 0) {
    freezeTurnsRemaining -= 1;
    events.push({ type: "freezeConsumed", placementsRemaining: freezeTurnsRemaining });
  } else {
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
  }

  // Resolve every expired piece as one simultaneous, non-recursive
  // explosion phase. Explosion-created rubble never triggers a line clear.
  let rngState = state.rngState;
  const expiration = resolveExpirations(grid, activeTimers, rngState, turnNumber);
  grid = expiration.grid;
  activeTimers = expiration.activeTimers;
  rngState = expiration.rngState;
  events.push(...expiration.events);

  // Score and combo. Explosions apply a per-explosion penalty (score floored
  // at zero) and reset the combo after any line-clear increment.
  const { scoreDelta, nextCombo } = calculateTurnScore({
    cellsPlaced: shape.cells.length,
    linesCleared: clearedLineCount,
    previousCombo: state.combo,
  });
  const penalty = expiration.explosionCount * EXPLOSION_SCORE_PENALTY;
  const totalScoreDelta = scoreDelta + defuseBonusTotal - penalty;
  const score = Math.max(0, state.score + totalScoreDelta);
  events.push({ type: "scoreChanged", delta: score - state.score, score });
  const comboAfterExplosions = expiration.explosionCount > 0 ? 0 : nextCombo;
  if (comboAfterExplosions !== state.combo) {
    events.push({ type: "comboChanged", combo: comboAfterExplosions });
  }

  // Consume the used piece; refill if the hand is exhausted.
  let hand = state.hand.filter((piece) => piece.handId !== handId);
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
    freezeTurnsRemaining,
    score,
    combo: comboAfterExplosions,
    bestCombo: Math.max(state.bestCombo, nextCombo),
    turn: turnNumber,
    piecesPlaced: state.piecesPlaced + 1,
    piecesDefused: state.piecesDefused + piecesDefusedThisTurn,
    linesCleared: state.linesCleared + clearedLineCount,
    explosions: state.explosions + expiration.explosionCount,
    rubbleCleared: state.rubbleCleared + rubbleClearedThisTurn,
    lastExplosionId: expiration.lastExplosionId ?? state.lastExplosionId,
    lastUpdatedAt: now,
  };

  // Check whether any current hand piece can fit.
  if (isGameOver(nextState.grid, nextState.hand)) {
    nextState.status = "gameOver";
    events.push({ type: "gameOver" });
  }

  return { ok: true, state: nextState, events };
}

/** Rewarded freeze: hold all timers for the next FREEZE_PLACEMENTS
 *  successful placements (BUILD_SPEC.md §6.16). */
export function activateFreeze(state: GameState, now: number): TurnResult {
  if (
    state.status !== "playing" ||
    state.rewardedFreezeUses >= MAX_REWARDED_FREEZES_PER_RUN ||
    state.freezeTurnsRemaining > 0
  ) {
    return reject(state);
  }

  const nextState: GameState = {
    ...state,
    freezeTurnsRemaining: FREEZE_PLACEMENTS,
    rewardedFreezeUses: state.rewardedFreezeUses + 1,
    lastUpdatedAt: now,
  };
  return {
    ok: true,
    state: nextState,
    events: [{ type: "freezeActivated", placementsRemaining: FREEZE_PLACEMENTS }],
  };
}

/** Rewarded defuse: permanently defuse the active piece with the lowest
 *  remaining timer; ties resolve to the earliest placement
 *  (BUILD_SPEC.md §6.17). Cells stay on the board as normal untimed blocks. */
export function applyRewardedDefuse(state: GameState, now: number): TurnResult {
  const timers = Object.values(state.activeTimers);
  if (
    state.status !== "playing" ||
    state.rewardedDefuseUses >= MAX_REWARDED_DEFUSES_PER_RUN ||
    timers.length === 0
  ) {
    return reject(state);
  }

  const target = timers.reduce((lowest, timer) =>
    timer.remainingTurns < lowest.remainingTurns ||
    (timer.remainingTurns === lowest.remainingTurns && timer.placedOnTurn < lowest.placedOnTurn)
      ? timer
      : lowest,
  );

  const grid = state.grid.map((row) =>
    row.map((cell): typeof cell =>
      cell.kind === "timed" && cell.pieceInstanceId === target.id
        ? { kind: "normal", colorId: cell.colorId }
        : cell,
    ),
  );
  const activeTimers = Object.fromEntries(
    Object.entries(state.activeTimers).filter(([id]) => id !== target.id),
  );

  const nextState: GameState = {
    ...state,
    grid,
    activeTimers,
    rewardedDefuseUses: state.rewardedDefuseUses + 1,
    piecesDefused: state.piecesDefused + 1,
    lastUpdatedAt: now,
  };
  return {
    ok: true,
    state: nextState,
    events: [{ type: "defuseActivated", pieceId: target.id }],
  };
}

/** @deprecated Dormant legacy rule; no V1 route or ad placement invokes it.
 * Rewarded revive: one per run, only from the game-over state
 *  (BUILD_SPEC.md §6.15). A failed or cancelled reward must simply never
 *  call this — rejected calls return the input state untouched. */
export function applyRevive(state: GameState, now: number): TurnResult {
  if (state.status !== "gameOver" || state.reviveUsed) {
    return reject(state);
  }

  const events: GameEvent[] = [];

  // Remove all rubble.
  const grid = state.grid.map((row) =>
    row.map((cell): typeof cell => (cell.kind === "rubble" ? { kind: "empty" } : cell)),
  );

  // Add moves to every active timer, capped.
  const activeTimers = Object.fromEntries(
    Object.entries(state.activeTimers).map(([id, timer]) => [
      id,
      {
        ...timer,
        remainingTurns: Math.min(timer.remainingTurns + REVIVE_TIMER_BONUS, REVIVE_TIMER_CAP),
      },
    ]),
  );

  // Replace the hand with small/medium pieces.
  const refill = generateHand(state.rngState, {
    refillIndex: state.handRefills,
    categories: REVIVE_HAND_CATEGORIES,
  });

  events.push({ type: "reviveApplied" });
  events.push({ type: "handRefilled", handIds: refill.hand.map((piece) => piece.handId) });
  if (state.combo !== 0) {
    events.push({ type: "comboChanged", combo: 0 });
  }

  const nextState: GameState = {
    ...state,
    grid,
    activeTimers,
    hand: refill.hand,
    rngState: refill.nextRngState,
    handRefills: state.handRefills + 1,
    combo: 0,
    reviveUsed: true,
    status: "playing",
    lastUpdatedAt: now,
  };

  // The board may still be unplayable if it is packed with normal blocks.
  if (isGameOver(nextState.grid, nextState.hand)) {
    nextState.status = "gameOver";
    events.push({ type: "gameOver" });
  }

  return { ok: true, state: nextState, events };
}
