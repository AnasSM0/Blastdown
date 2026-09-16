/// <reference types="node" />

import {
  MAX_REWARDED_DEFUSES_PER_RUN,
  MAX_REWARDED_FREEZES_PER_RUN,
} from "../../src/config/balance";
import type { GameEvent } from "../../src/domain/events";
import {
  activateFreeze,
  applyRewardedDefuse,
  createInitialGameState,
  placePiece,
} from "../../src/domain/game";
import type { GameState } from "../../src/domain/gameTypes";
import { isValidPlacement, type CellPosition } from "../../src/domain/placement";
import { createInitialRngState, nextInt } from "../../src/domain/seededRandom";
import {
  canActivateFreeze,
  canApplyRewardedDefuse,
  getPlacementPrediction,
} from "../../src/domain/selectors";
import { getShapeById, SHAPE_CATALOG, type ShapeCategory } from "../../src/domain/shapes";

export const SIMULATION_STRATEGIES = [
  "randomLegal",
  "greedyClear",
  "survival",
  "survivalRecovery",
] as const;

export type SimulationStrategy = (typeof SIMULATION_STRATEGIES)[number];

type CandidateMove = {
  handId: string;
  origin: CellPosition;
  lines: number;
  cells: number;
};

type TurnTail = {
  turn: number;
  occupancy: number;
  rubble: number;
  lowestTimer: number | null;
  legalMoves: number;
  playableHandPieces: number;
  linesCleared: number;
  explosions: number;
};

type EarlyPhaseMetrics = {
  turnsObserved: number;
  linesCleared: number;
  explosions: number;
  naturalDefuses: number;
  timer1Rescues: number;
};

export type SimulationRun = {
  strategy: SimulationStrategy;
  seed: string;
  turns: number;
  score: number;
  linesCleared: number;
  explosions: number;
  rubbleCreated: number;
  naturalDefuses: number;
  timer1Rescues: number;
  timer1Warnings: number;
  timer2Warnings: number;
  timer1StateTurns: number;
  timer2StateTurns: number;
  multipleExpirationTurns: number;
  explosionTurnGaps: number[];
  bestCombo: number;
  handRefills: number;
  duplicateShapeHands: number;
  activeTimerSamples: number;
  maxActiveTimers: number;
  forcedChoiceTurns: number;
  logicallyUnavoidableExplosionTurns: number;
  earlyPressureProxy: boolean;
  freezeOpportunities: number;
  defuseOpportunities: number;
  freezeUses: number;
  defuseUses: number;
  finalOccupancy: number;
  finalRubble: number;
  finalNormal: number;
  finalTimed: number;
  finalTail: TurnTail[];
  earlyPhases: Record<"first5" | "first10" | "first20", EarlyPhaseMetrics>;
  generatedShapes: Record<string, number>;
  generatedCategories: Record<ShapeCategory, number>;
  censored: boolean;
};

export type Distribution = {
  p25: number;
  median: number;
  p75: number;
  p90: number;
};

export type PopulationSummary = {
  strategy: SimulationStrategy;
  runs: number;
  censoredRuns: number;
  distributions: {
    turns: Distribution;
    score: Distribution;
    linesCleared: Distribution;
    explosions: Distribution;
    rubbleCreated: Distribution;
    naturalDefuses: Distribution;
    bestCombo: Distribution;
    handRefills: Distribution;
    finalOccupancy: Distribution;
    finalRubble: Distribution;
  };
  rates: {
    linesPer100Turns: number;
    explosionsPer100Turns: number;
    naturalDefusesPer100Turns: number;
    timer1RescuesPer100Turns: number;
    timer1WarningsPer100Turns: number;
    timer2WarningsPer100Turns: number;
    multipleExpirationsPer100Turns: number;
    forcedChoiceTurnPercent: number;
    unavoidableExplosionTurnPercent: number;
    runsWithEarlyPressureProxyPercent: number;
    runsWithExplosionInFinalFivePercent: number;
    runsWithTimer1InFinalFivePercent: number;
    averageActiveTimedPieces: number;
    averageTurnsBetweenExplosions: number | null;
    duplicateShapeHandPercent: number;
    freezeOpportunitiesPerRun: number;
    defuseOpportunitiesPerRun: number;
    freezeUsesPerRun: number;
    defuseUsesPerRun: number;
  };
  generatedCategoryPercent: Record<ShapeCategory, number>;
  generatedShapePercent: Record<string, number>;
  earlyPhases: Record<
    "first5" | "first10" | "first20",
    {
      averageTurnsObserved: number;
      runsWithClearPercent: number;
      runsWithExplosionPercent: number;
      runsWithNaturalDefusePercent: number;
      runsWithTimer1RescuePercent: number;
    }
  >;
};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function occupiedCounts(state: GameState): {
  occupancy: number;
  rubble: number;
  normal: number;
  timed: number;
} {
  let rubble = 0;
  let normal = 0;
  let timed = 0;
  for (const row of state.grid) {
    for (const cell of row) {
      if (cell.kind === "rubble") rubble += 1;
      if (cell.kind === "normal") normal += 1;
      if (cell.kind === "timed") timed += 1;
    }
  }
  return { occupancy: rubble + normal + timed, rubble, normal, timed };
}

function lowestTimer(state: GameState): number | null {
  const values = Object.values(state.activeTimers).map((timer) => timer.remainingTurns);
  return values.length === 0 ? null : Math.min(...values);
}

function enumerateMoves(state: GameState): CandidateMove[] {
  const moves: CandidateMove[] = [];
  for (const piece of state.hand) {
    const shape = getShapeById(piece.shapeId);
    if (!shape) continue;
    for (let row = 0; row < state.grid.length; row += 1) {
      for (let column = 0; column < state.grid.length; column += 1) {
        const origin = { row, column };
        if (!isValidPlacement(state.grid, shape, origin)) continue;
        const prediction = getPlacementPrediction(state, piece.handId, origin);
        moves.push({
          handId: piece.handId,
          origin,
          lines: prediction.clear.rows.length + prediction.clear.columns.length,
          cells: shape.cells.length,
        });
      }
    }
  }
  return moves;
}

function pickTie<T>(items: readonly T[], playerRngState: number): { item: T; nextState: number } {
  const pick = nextInt(playerRngState, items.length);
  return { item: items[pick.value], nextState: pick.nextState };
}

type SurvivalScore = readonly [number, number, number, number, number, number, number];

function survivalScore(state: GameState, move: CandidateMove): SurvivalScore {
  const result = placePiece(state, move.handId, move.origin, state.turn + 1);
  const timer1Rescues = result.events.filter(
    (event) => event.type === "pieceDefused" && event.remainingTurns === 1,
  ).length;
  const defuseUrgency = result.events
    .filter(
      (event): event is Extract<GameEvent, { type: "pieceDefused" }> =>
        event.type === "pieceDefused",
    )
    .reduce((sum, event) => sum + Math.max(0, 8 - event.remainingTurns), 0);
  const explosions = result.state.explosions - state.explosions;
  const criticalTimers = Object.values(result.state.activeTimers).filter(
    (timer) => timer.remainingTurns <= 2,
  ).length;
  return [
    result.state.status === "playing" ? 1 : 0,
    -explosions,
    timer1Rescues,
    defuseUrgency,
    move.lines,
    -criticalTimers,
    -occupiedCounts(result.state).occupancy,
  ];
}

function compareScore(left: SurvivalScore, right: SurvivalScore): number {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function chooseMove(
  state: GameState,
  moves: readonly CandidateMove[],
  strategy: SimulationStrategy,
  playerRngState: number,
): { move: CandidateMove; nextState: number } {
  if (strategy === "randomLegal") {
    const picked = pickTie(moves, playerRngState);
    return { move: picked.item, nextState: picked.nextState };
  }

  if (strategy === "greedyClear") {
    const bestLines = Math.max(...moves.map((move) => move.lines));
    const lineCandidates = moves.filter((move) => move.lines === bestLines);
    const smallest = Math.min(...lineCandidates.map((move) => move.cells));
    const picked = pickTie(
      lineCandidates.filter((move) => move.cells === smallest),
      playerRngState,
    );
    return { move: picked.item, nextState: picked.nextState };
  }

  let bestScore: SurvivalScore | null = null;
  let bestMoves: CandidateMove[] = [];
  for (const move of moves) {
    const score = survivalScore(state, move);
    const comparison = bestScore ? compareScore(score, bestScore) : 1;
    if (comparison > 0) {
      bestScore = score;
      bestMoves = [move];
    } else if (comparison === 0) {
      bestMoves.push(move);
    }
  }
  const picked = pickTie(bestMoves, playerRngState);
  return { move: picked.item, nextState: picked.nextState };
}

function assertStateIntegrity(state: GameState): void {
  if (state.grid.length !== 8 || state.grid.some((row) => row.length !== 8)) {
    throw new Error(`Corrupt board at ${state.seed}:${state.turn}`);
  }
  if (
    [state.score, state.turn, state.linesCleared, state.explosions, state.piecesDefused].some(
      (value) => !Number.isFinite(value) || value < 0,
    )
  ) {
    throw new Error(`Invalid counter at ${state.seed}:${state.turn}`);
  }
  for (const timer of Object.values(state.activeTimers)) {
    const hasCell = state.grid.some((row) =>
      row.some((cell) => cell.kind === "timed" && cell.pieceInstanceId === timer.id),
    );
    if (!hasCell || timer.remainingTurns <= 0) {
      throw new Error(`Orphan/expired timer at ${state.seed}:${state.turn}`);
    }
  }
}

function createShapeCounter(): Record<string, number> {
  return Object.fromEntries(SHAPE_CATALOG.map((shape) => [shape.id, 0]));
}

function recordHand(
  state: GameState,
  generatedShapes: Record<string, number>,
  generatedCategories: Record<ShapeCategory, number>,
): boolean {
  for (const piece of state.hand) {
    generatedShapes[piece.shapeId] = (generatedShapes[piece.shapeId] ?? 0) + 1;
    const shape = getShapeById(piece.shapeId);
    if (shape) generatedCategories[shape.category] += 1;
  }
  return new Set(state.hand.map((piece) => piece.shapeId)).size < state.hand.length;
}

function allLegalMovesExplode(state: GameState, moves: readonly CandidateMove[]): boolean {
  return (
    moves.length > 0 &&
    moves.every((move) => {
      const result = placePiece(state, move.handId, move.origin, state.turn + 1);
      return result.state.explosions > state.explosions;
    })
  );
}

function createEarlyPhaseMetrics(): EarlyPhaseMetrics {
  return {
    turnsObserved: 0,
    linesCleared: 0,
    explosions: 0,
    naturalDefuses: 0,
    timer1Rescues: 0,
  };
}

export function simulateRun(
  strategy: SimulationStrategy,
  seed: string,
  maxTurns = 500,
): SimulationRun {
  let state = createInitialGameState(seed, 0);
  // Keep tie-breaking entropy identical across strategies so paired seeds
  // isolate strategy decisions instead of assigning each policy a different
  // stream of otherwise-equivalent choices.
  let playerRngState = createInitialRngState(`player:${seed}`);
  const generatedShapes = createShapeCounter();
  const generatedCategories: Record<ShapeCategory, number> = { small: 0, medium: 0, large: 0 };
  let duplicateShapeHands = recordHand(state, generatedShapes, generatedCategories) ? 1 : 0;
  let rubbleCreated = 0;
  let naturalDefuses = 0;
  let timer1Rescues = 0;
  let timer1Warnings = 0;
  let timer2Warnings = 0;
  let timer1StateTurns = 0;
  let timer2StateTurns = 0;
  let multipleExpirationTurns = 0;
  let activeTimerSamples = 0;
  let maxActiveTimers = 0;
  let forcedChoiceTurns = 0;
  let logicallyUnavoidableExplosionTurns = 0;
  let earlyPressureProxy = false;
  let freezeOpportunities = 0;
  let defuseOpportunities = 0;
  let freezeUses = 0;
  let defuseUses = 0;
  let lastExplosionTurn: number | null = null;
  const explosionTurnGaps: number[] = [];
  const finalTail: TurnTail[] = [];
  const earlyPhases = {
    first5: createEarlyPhaseMetrics(),
    first10: createEarlyPhaseMetrics(),
    first20: createEarlyPhaseMetrics(),
  };

  while (state.status === "playing" && state.turn < maxTurns) {
    assertStateIntegrity(state);
    if (Object.keys(state.activeTimers).length > 0 && canActivateFreeze(state)) {
      freezeOpportunities += 1;
    }
    if (canApplyRewardedDefuse(state)) defuseOpportunities += 1;

    if (strategy === "survivalRecovery") {
      const timerValues = Object.values(state.activeTimers);
      const minimum = lowestTimer(state);
      if (minimum === 1 && canApplyRewardedDefuse(state)) {
        const defuse = applyRewardedDefuse(state, state.turn);
        if (defuse.ok) {
          state = defuse.state;
          defuseUses += 1;
        }
      }
      const lowTimerCount = Object.values(state.activeTimers).filter(
        (timer) => timer.remainingTurns <= 2,
      ).length;
      if (timerValues.length > 0 && lowTimerCount >= 2 && canActivateFreeze(state)) {
        const freeze = activateFreeze(state, state.turn);
        if (freeze.ok) {
          state = freeze.state;
          freezeUses += 1;
        }
      }
    }

    const moves = enumerateMoves(state);
    if (moves.length === 0) break;
    const playableHandPieces = new Set(moves.map((move) => move.handId)).size;
    if (playableHandPieces <= 1 || moves.length <= 3) forcedChoiceTurns += 1;

    const timerOnePresent = Object.values(state.activeTimers).some(
      (timer) => timer.remainingTurns === 1,
    );
    if (timerOnePresent && allLegalMovesExplode(state, moves)) {
      logicallyUnavoidableExplosionTurns += 1;
      if (state.turn < 20) earlyPressureProxy = true;
    }

    const choice = chooseMove(state, moves, strategy, playerRngState);
    playerRngState = choice.nextState;
    const result = placePiece(state, choice.move.handId, choice.move.origin, state.turn + 1);
    if (!result.ok) throw new Error(`Legal move rejected at ${seed}:${state.turn}`);
    state = result.state;

    const turnExplosions = result.events.filter(
      (event) => event.type === "explosionStarted",
    ).length;
    const turnLines = result.events
      .filter(
        (event): event is Extract<GameEvent, { type: "linesCleared" }> =>
          event.type === "linesCleared",
      )
      .reduce((sum, event) => sum + event.rows.length + event.columns.length, 0);
    rubbleCreated += result.events
      .filter(
        (event): event is Extract<GameEvent, { type: "rubbleCreated" }> =>
          event.type === "rubbleCreated",
      )
      .reduce((sum, event) => sum + event.cells.length, 0);
    const defuses = result.events.filter(
      (event): event is Extract<GameEvent, { type: "pieceDefused" }> =>
        event.type === "pieceDefused",
    );
    naturalDefuses += defuses.length;
    timer1Rescues += defuses.filter((event) => event.remainingTurns === 1).length;
    for (const [phase, limit] of [
      ["first5", 5],
      ["first10", 10],
      ["first20", 20],
    ] as const) {
      if (state.turn <= limit) {
        earlyPhases[phase].turnsObserved += 1;
        earlyPhases[phase].linesCleared += turnLines;
        earlyPhases[phase].explosions += turnExplosions;
        earlyPhases[phase].naturalDefuses += defuses.length;
        earlyPhases[phase].timer1Rescues += defuses.filter(
          (event) => event.remainingTurns === 1,
        ).length;
      }
    }
    timer1Warnings += result.events.filter(
      (event) => event.type === "timerWarning" && event.remainingTurns === 1,
    ).length;
    timer2Warnings += result.events.filter(
      (event) => event.type === "timerWarning" && event.remainingTurns === 2,
    ).length;
    if (turnExplosions > 1) multipleExpirationTurns += 1;
    if (turnExplosions > 0) {
      if (lastExplosionTurn !== null) explosionTurnGaps.push(state.turn - lastExplosionTurn);
      lastExplosionTurn = state.turn;
    }
    if (result.events.some((event) => event.type === "handRefilled")) {
      if (recordHand(state, generatedShapes, generatedCategories)) duplicateShapeHands += 1;
    }

    const timerValues = Object.values(state.activeTimers).map((timer) => timer.remainingTurns);
    if (timerValues.includes(1)) timer1StateTurns += 1;
    if (timerValues.includes(2)) timer2StateTurns += 1;
    activeTimerSamples += timerValues.length;
    maxActiveTimers = Math.max(maxActiveTimers, timerValues.length);
    const counts = occupiedCounts(state);
    finalTail.push({
      turn: state.turn,
      occupancy: counts.occupancy,
      rubble: counts.rubble,
      lowestTimer: lowestTimer(state),
      legalMoves: moves.length,
      playableHandPieces,
      linesCleared: turnLines,
      explosions: turnExplosions,
    });
    if (finalTail.length > 5) finalTail.shift();
  }

  assertStateIntegrity(state);
  const final = occupiedCounts(state);
  return {
    strategy,
    seed,
    turns: state.turn,
    score: state.score,
    linesCleared: state.linesCleared,
    explosions: state.explosions,
    rubbleCreated,
    naturalDefuses,
    timer1Rescues,
    timer1Warnings,
    timer2Warnings,
    timer1StateTurns,
    timer2StateTurns,
    multipleExpirationTurns,
    explosionTurnGaps,
    bestCombo: state.bestCombo,
    handRefills: state.handRefills,
    duplicateShapeHands,
    activeTimerSamples,
    maxActiveTimers,
    forcedChoiceTurns,
    logicallyUnavoidableExplosionTurns,
    earlyPressureProxy,
    freezeOpportunities,
    defuseOpportunities,
    freezeUses,
    defuseUses,
    finalOccupancy: final.occupancy,
    finalRubble: final.rubble,
    finalNormal: final.normal,
    finalTimed: final.timed,
    finalTail,
    earlyPhases,
    generatedShapes,
    generatedCategories,
    censored: state.status === "playing" && state.turn >= maxTurns,
  };
}

function percentile(values: readonly number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const interpolated = sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
  return round(interpolated);
}

function distribution(values: readonly number[]): Distribution {
  return {
    p25: percentile(values, 0.25),
    median: percentile(values, 0.5),
    p75: percentile(values, 0.75),
    p90: percentile(values, 0.9),
  };
}

function percent(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : round((numerator / denominator) * 100);
}

function mean(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function summarizeRuns(runs: readonly SimulationRun[]): PopulationSummary {
  if (runs.length === 0) throw new Error("Cannot summarize an empty population");
  const strategy = runs[0].strategy;
  if (runs.some((run) => run.strategy !== strategy)) {
    throw new Error("Population summaries require one strategy");
  }
  const totalTurns = runs.reduce((sum, run) => sum + run.turns, 0);
  const totalHands = runs.reduce((sum, run) => sum + run.handRefills, 0);
  const categoryTotals: Record<ShapeCategory, number> = { small: 0, medium: 0, large: 0 };
  const shapeTotals = createShapeCounter();
  for (const run of runs) {
    for (const category of Object.keys(categoryTotals) as ShapeCategory[]) {
      categoryTotals[category] += run.generatedCategories[category];
    }
    for (const shape of SHAPE_CATALOG) {
      shapeTotals[shape.id] += run.generatedShapes[shape.id];
    }
  }
  const totalShapes = Object.values(shapeTotals).reduce((sum, value) => sum + value, 0);
  const allGaps = runs.flatMap((run) => run.explosionTurnGaps);
  const finalFive = runs.map((run) => run.finalTail);

  return {
    strategy,
    runs: runs.length,
    censoredRuns: runs.filter((run) => run.censored).length,
    distributions: {
      turns: distribution(runs.map((run) => run.turns)),
      score: distribution(runs.map((run) => run.score)),
      linesCleared: distribution(runs.map((run) => run.linesCleared)),
      explosions: distribution(runs.map((run) => run.explosions)),
      rubbleCreated: distribution(runs.map((run) => run.rubbleCreated)),
      naturalDefuses: distribution(runs.map((run) => run.naturalDefuses)),
      bestCombo: distribution(runs.map((run) => run.bestCombo)),
      handRefills: distribution(runs.map((run) => run.handRefills)),
      finalOccupancy: distribution(runs.map((run) => run.finalOccupancy)),
      finalRubble: distribution(runs.map((run) => run.finalRubble)),
    },
    rates: {
      linesPer100Turns: percent(
        runs.reduce((sum, run) => sum + run.linesCleared, 0),
        totalTurns,
      ),
      explosionsPer100Turns: percent(
        runs.reduce((sum, run) => sum + run.explosions, 0),
        totalTurns,
      ),
      naturalDefusesPer100Turns: percent(
        runs.reduce((sum, run) => sum + run.naturalDefuses, 0),
        totalTurns,
      ),
      timer1RescuesPer100Turns: percent(
        runs.reduce((sum, run) => sum + run.timer1Rescues, 0),
        totalTurns,
      ),
      timer1WarningsPer100Turns: percent(
        runs.reduce((sum, run) => sum + run.timer1Warnings, 0),
        totalTurns,
      ),
      timer2WarningsPer100Turns: percent(
        runs.reduce((sum, run) => sum + run.timer2Warnings, 0),
        totalTurns,
      ),
      multipleExpirationsPer100Turns: percent(
        runs.reduce((sum, run) => sum + run.multipleExpirationTurns, 0),
        totalTurns,
      ),
      forcedChoiceTurnPercent: percent(
        runs.reduce((sum, run) => sum + run.forcedChoiceTurns, 0),
        totalTurns,
      ),
      unavoidableExplosionTurnPercent: percent(
        runs.reduce((sum, run) => sum + run.logicallyUnavoidableExplosionTurns, 0),
        totalTurns,
      ),
      runsWithEarlyPressureProxyPercent: percent(
        runs.filter((run) => run.earlyPressureProxy).length,
        runs.length,
      ),
      runsWithExplosionInFinalFivePercent: percent(
        finalFive.filter((turns) => turns.some((turn) => turn.explosions > 0)).length,
        runs.length,
      ),
      runsWithTimer1InFinalFivePercent: percent(
        finalFive.filter((turns) => turns.some((turn) => turn.lowestTimer === 1)).length,
        runs.length,
      ),
      averageActiveTimedPieces: round(
        runs.reduce((sum, run) => sum + run.activeTimerSamples, 0) / Math.max(1, totalTurns),
      ),
      averageTurnsBetweenExplosions: allGaps.length === 0 ? null : mean(allGaps),
      duplicateShapeHandPercent: percent(
        runs.reduce((sum, run) => sum + run.duplicateShapeHands, 0),
        totalHands,
      ),
      freezeOpportunitiesPerRun: mean(runs.map((run) => run.freezeOpportunities)),
      defuseOpportunitiesPerRun: mean(runs.map((run) => run.defuseOpportunities)),
      freezeUsesPerRun: mean(runs.map((run) => run.freezeUses)),
      defuseUsesPerRun: mean(runs.map((run) => run.defuseUses)),
    },
    generatedCategoryPercent: {
      small: percent(categoryTotals.small, totalShapes),
      medium: percent(categoryTotals.medium, totalShapes),
      large: percent(categoryTotals.large, totalShapes),
    },
    generatedShapePercent: Object.fromEntries(
      Object.entries(shapeTotals).map(([shape, count]) => [shape, percent(count, totalShapes)]),
    ),
    earlyPhases: Object.fromEntries(
      (["first5", "first10", "first20"] as const).map((phase) => {
        const values = runs.map((run) => run.earlyPhases[phase]);
        return [
          phase,
          {
            averageTurnsObserved: mean(values.map((value) => value.turnsObserved)),
            runsWithClearPercent: percent(
              values.filter((value) => value.linesCleared > 0).length,
              runs.length,
            ),
            runsWithExplosionPercent: percent(
              values.filter((value) => value.explosions > 0).length,
              runs.length,
            ),
            runsWithNaturalDefusePercent: percent(
              values.filter((value) => value.naturalDefuses > 0).length,
              runs.length,
            ),
            runsWithTimer1RescuePercent: percent(
              values.filter((value) => value.timer1Rescues > 0).length,
              runs.length,
            ),
          },
        ];
      }),
    ) as PopulationSummary["earlyPhases"],
  };
}

export function simulatePopulation(
  strategy: SimulationStrategy,
  runCount: number,
  maxTurns = 500,
): PopulationSummary {
  const runs = Array.from({ length: runCount }, (_, index) =>
    simulateRun(strategy, `b10-${index.toString().padStart(5, "0")}`, maxTurns),
  );
  return summarizeRuns(runs);
}

function parsePositiveInteger(flag: string, fallback: number): number {
  const index = process.argv.indexOf(flag);
  if (index < 0) return fallback;
  const value = Number(process.argv[index + 1]);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${flag} must be positive`);
  return value;
}

if (require.main === module) {
  const runCount = parsePositiveInteger("--runs", 2_000);
  const maxTurns = parsePositiveInteger("--max-turns", 500);
  const summaries = SIMULATION_STRATEGIES.map((strategy) =>
    simulatePopulation(strategy, runCount, maxTurns),
  );
  const totalRuns = runCount * SIMULATION_STRATEGIES.length;
  process.stdout.write(
    `${JSON.stringify({ runCount, totalRuns, maxTurns, summaries }, null, 2)}\n`,
  );
}

export const POWER_UP_LIMITS = {
  freeze: MAX_REWARDED_FREEZES_PER_RUN,
  defuse: MAX_REWARDED_DEFUSES_PER_RUN,
} as const;
