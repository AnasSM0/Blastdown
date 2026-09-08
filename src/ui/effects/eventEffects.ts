import type { GameEvent } from "../../domain/events";
import type { GridCell } from "../../domain/gameTypes";
import type { CellPosition } from "../../domain/placement";
import { BOARD_SIZE } from "../../domain/board";

/** One explosion's visible footprint: the rubble cells the domain reported for
 *  it (BUILD_SPEC.md §6.12). Kept per-explosion and in event order so multiple
 *  simultaneous explosions stay individually readable and deterministic. */
export type ExplosionEffect = {
  explosionId: string;
  pieceId: string;
  cells: CellPosition[];
};

export type DefuseEffect = {
  pieceId: string;
  bonus: number;
  /** Cells the defused piece occupied immediately before the turn resolved,
   *  resolved from the pre-turn grid so the effect lands on the piece that was
   *  actually defused instead of on the cleared lines' midpoint. Empty when no
   *  pre-turn grid was supplied (the caller then falls back to the clear). */
  cells: CellPosition[];
};

/** Effects that are NOT produced by a placement turn. The rewarded defuse and
 *  the revive mutate the board without advancing `state.turn`, so they can't be
 *  driven by the turn-keyed event stream — the screen plays them as an explicit
 *  cue instead, carrying the cells it read from the authoritative pre-action
 *  state. */
export type EffectCueKind = "rewardedDefuse" | "revive";

export type ClearTier = 1 | 2 | 3 | 4;

export type ClearTiming = Readonly<{
  impactStartMs: 0;
  impactEndMs: number;
  sweepStartMs: number;
  sweepEndMs: number;
  releaseStartMs: number;
  releaseEndMs: number;
  recoveryEndMs: number;
}>;

/** Renderer-independent line-clear presentation derived only from the
 * committed `linesCleared` event. Identity and session generation wrap this
 * contract in `LiveEffect`; renderers never invent either value. */
export type ClearPresentation = Readonly<{
  rows: readonly number[];
  columns: readonly number[];
  /** Deduplicated union of all participating cells, row-major. */
  cells: readonly CellPosition[];
  /** Row/column crossings, each emitted exactly once, row-major. */
  intersections: readonly CellPosition[];
  lineCount: number;
  tier: ClearTier;
  bloomIntensity: number;
  timing: ClearTiming;
}>;

export type BoardImpulse = Readonly<{
  source: "clear" | "explosion";
  amplitudePx: number;
  durationMs: number;
}>;

/** A presentation-only translation of one turn's domain events into the visual
 *  beats to play. It never recomputes gameplay — it only reshapes what the
 *  engine already decided (cleared lines, defuses, explosions, rubble, score,
 *  combo) into cells and durations for the overlays. */
export type EffectPlan = {
  /** The canonical committed-clear presentation contract. */
  clear: ClearPresentation | null;
  /** One group-level impulse for this whole effect, never per-cell. */
  boardImpulse: BoardImpulse | null;
  rows: number[];
  columns: number[];
  /** Deduplicated cells of every cleared row/column (intersections appear
   *  exactly once), in row-major order. */
  clearedCells: CellPosition[];
  defuses: DefuseEffect[];
  explosions: ExplosionEffect[];
  /** Deduplicated union of every explosion's rubble cells, row-major. */
  rubbleCells: CellPosition[];
  /** Cells restored by a revive (the rubble that was cleared), row-major. Only
   *  ever populated by a revive cue. */
  reviveCells: CellPosition[];
  scoreDelta: number;
  score: number;
  /** Combo value emitted this turn, or null when unchanged. */
  combo: number | null;
  comboReset: boolean;
  /** Set when this plan came from an out-of-turn cue rather than the event
   *  stream; null for a normal placement turn. */
  cue: EffectCueKind | null;
  /** True when a clear, defuse, or explosion produced a sequence worth
   *  presenting. Plain placements have none. This never controls input. */
  hasRequiredSequence: boolean;
  /** How long the presentation sequence should remain live, in ms. */
  durationMs: number;
};

/** View budget per effect group. A clear can legitimately cover the whole board
 *  (8 rows + 8 columns), so its budget is the board itself; explosion bursts are
 *  capped well below that because they are the heavier view (border + scale) and
 *  several pieces can expire on one turn. Anything past the cap is dropped, not
 *  queued — the effect stays readable and the view count stays bounded. */
export const MAX_CLEAR_CELLS = BOARD_SIZE * BOARD_SIZE;
export const MAX_BURST_CELLS = 24;
export const MAX_REVIVE_CELLS = BOARD_SIZE * BOARD_SIZE;

function cellKey(cell: CellPosition): string {
  return `${cell.row},${cell.column}`;
}

function clearedCellsFor(rows: number[], columns: number[], size: number): CellPosition[] {
  const seen = new Set<string>();
  const cells: CellPosition[] = [];
  const rowSet = new Set(rows);
  const columnSet = new Set(columns);
  // Row-major sweep so intersection cells are emitted once, deterministically.
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      if (!rowSet.has(row) && !columnSet.has(column)) {
        continue;
      }
      const key = `${row},${column}`;
      if (!seen.has(key)) {
        seen.add(key);
        cells.push({ row, column });
      }
    }
  }
  return cells;
}

function intersectionsFor(rows: readonly number[], columns: readonly number[]): CellPosition[] {
  const rowSet = new Set(rows);
  const columnSet = new Set(columns);
  const intersections: CellPosition[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let column = 0; column < BOARD_SIZE; column++) {
      if (rowSet.has(row) && columnSet.has(column)) {
        intersections.push({ row, column });
      }
    }
  }
  return intersections;
}

type Grid = readonly (readonly GridCell[])[];

/** Cells a timed piece occupies in a grid, row-major. A read-only scan of state
 *  the domain already produced — no piece grouping is reconstructed, the cells
 *  carry their own `pieceInstanceId`. */
export function cellsOfPiece(grid: Grid, pieceId: string): CellPosition[] {
  const cells: CellPosition[] = [];
  for (let row = 0; row < grid.length; row++) {
    const rowCells = grid[row];
    for (let column = 0; column < rowCells.length; column++) {
      const cell = rowCells[column];
      if (cell.kind === "timed" && cell.pieceInstanceId === pieceId) {
        cells.push({ row, column });
      }
    }
  }
  return cells;
}

/** Rubble cells in a grid, row-major. Read by the screen from the pre-revive
 *  state so the recovery wave covers exactly the cells the revive will restore. */
export function rubbleCellsOf(grid: Grid): CellPosition[] {
  const cells: CellPosition[] = [];
  for (let row = 0; row < grid.length; row++) {
    const rowCells = grid[row];
    for (let column = 0; column < rowCells.length; column++) {
      if (rowCells[column].kind === "rubble") {
        cells.push({ row, column });
      }
    }
  }
  return cells;
}

/** Per-cell start delay (ms) for the line-clear sweep, keyed "row,column".
 *  A cleared ROW sweeps left→right (delay grows with the column); a cleared
 *  COLUMN sweeps top→bottom (delay grows with the row). A cell in both takes
 *  the earlier of the two, so an intersection never stalls behind the slower
 *  line and simultaneous clears still read as separate directional sweeps. */
export function sweepDelaysFor(
  rows: readonly number[],
  columns: readonly number[],
  stepMs: number,
  capMs: number,
): Map<string, number> {
  const delays = new Map<string, number>();
  const put = (row: number, column: number, delay: number) => {
    const key = `${row},${column}`;
    const capped = Math.min(delay, capMs);
    const existing = delays.get(key);
    if (existing === undefined || capped < existing) {
      delays.set(key, capped);
    }
  };
  for (const row of rows) {
    for (let column = 0; column < BOARD_SIZE; column++) {
      put(row, column, column * stepMs);
    }
  }
  for (const column of columns) {
    for (let row = 0; row < BOARD_SIZE; row++) {
      put(row, column, row * stepMs);
    }
  }
  return delays;
}

const REDUCED_MS = 120;
const REDUCED_CLEAR_MS = 180;
const DEFUSE_MS = 340;
const EXPLOSION_MS = 440;
const CUE_MS = 400;
const CUE_REDUCED_MS = 140;

type ClearProfile = Readonly<{
  bloomIntensity: number;
  impulsePx: number;
  impulseDurationMs: number;
  sweepEndMs: number;
  releaseEndMs: number;
  recoveryEndMs: number;
}>;

const CLEAR_PROFILES: Record<ClearTier, ClearProfile> = {
  1: {
    bloomIntensity: 0.46,
    impulsePx: 0,
    impulseDurationMs: 0,
    sweepEndMs: 280,
    releaseEndMs: 440,
    recoveryEndMs: 450,
  },
  2: {
    bloomIntensity: 0.64,
    impulsePx: 2,
    impulseDurationMs: 150,
    sweepEndMs: 310,
    releaseEndMs: 500,
    recoveryEndMs: 560,
  },
  3: {
    bloomIntensity: 0.82,
    impulsePx: 4,
    impulseDurationMs: 250,
    sweepEndMs: 340,
    releaseEndMs: 580,
    recoveryEndMs: 680,
  },
  4: {
    bloomIntensity: 1,
    impulsePx: 6,
    impulseDurationMs: 350,
    sweepEndMs: 400,
    releaseEndMs: 720,
    recoveryEndMs: 880,
  },
};

function clearTier(lineCount: number): ClearTier {
  if (lineCount >= 4) return 4;
  if (lineCount === 3) return 3;
  if (lineCount === 2) return 2;
  return 1;
}

function clearPresentation(
  rows: number[],
  columns: number[],
  reducedMotion: boolean,
): ClearPresentation | null {
  const lineCount = rows.length + columns.length;
  if (lineCount === 0) {
    return null;
  }
  const tier = clearTier(lineCount);
  const profile = CLEAR_PROFILES[tier];
  const timing: ClearTiming = reducedMotion
    ? {
        impactStartMs: 0,
        impactEndMs: 60,
        sweepStartMs: 0,
        sweepEndMs: 160,
        releaseStartMs: 80,
        releaseEndMs: 150,
        recoveryEndMs: REDUCED_CLEAR_MS,
      }
    : {
        impactStartMs: 0,
        impactEndMs: 80,
        sweepStartMs: 80,
        sweepEndMs: profile.sweepEndMs,
        releaseStartMs: 220,
        releaseEndMs: profile.releaseEndMs,
        recoveryEndMs: profile.recoveryEndMs,
      };
  return {
    rows: [...rows],
    columns: [...columns],
    cells: clearedCellsFor(rows, columns, BOARD_SIZE),
    intersections: intersectionsFor(rows, columns),
    lineCount,
    tier,
    bloomIntensity: profile.bloomIntensity,
    timing,
  };
}

/** Read-only context the plan needs but the event stream doesn't carry. */
export type EffectPlanContext = {
  /** The grid as it stood BEFORE this turn resolved, used to locate a defused
   *  piece's cells (the `pieceDefused` event carries no footprint). */
  previousGrid?: Grid;
};

function emptyPlan(): EffectPlan {
  return {
    clear: null,
    boardImpulse: null,
    rows: [],
    columns: [],
    clearedCells: [],
    defuses: [],
    explosions: [],
    rubbleCells: [],
    reviveCells: [],
    scoreDelta: 0,
    score: 0,
    combo: null,
    comboReset: false,
    cue: null,
    hasRequiredSequence: false,
    durationMs: 0,
  };
}

/** Build the visual plan for a turn's events. Pure: the same events, reduced
 *  flag, and context always yield the same plan, so ordering, once-only
 *  animation, and intersection dedup are unit-testable without mounting
 *  anything. */
export function buildEffectPlan(
  events: readonly GameEvent[],
  reducedMotion: boolean,
  context: EffectPlanContext = {},
): EffectPlan {
  let rows: number[] = [];
  let columns: number[] = [];
  const defuses: DefuseEffect[] = [];
  const explosions: ExplosionEffect[] = [];
  const explosionsById = new Map<string, ExplosionEffect>();
  let scoreDelta = 0;
  let score = 0;
  let combo: number | null = null;

  for (const event of events) {
    switch (event.type) {
      case "linesCleared":
        rows = [...event.rows];
        columns = [...event.columns];
        break;
      case "pieceDefused":
        defuses.push({
          pieceId: event.pieceId,
          bonus: event.bonus,
          // The piece is already gone from the post-turn grid, so its footprint
          // is read from the pre-turn one. Without it the effect has no target
          // and the layer falls back to the cleared lines.
          cells: context.previousGrid ? cellsOfPiece(context.previousGrid, event.pieceId) : [],
        });
        break;
      case "explosionStarted": {
        const effect: ExplosionEffect = {
          explosionId: event.explosionId,
          pieceId: event.pieceId,
          cells: [],
        };
        explosions.push(effect);
        explosionsById.set(event.explosionId, effect);
        break;
      }
      case "rubbleCreated": {
        const effect = explosionsById.get(event.explosionId);
        if (effect) {
          effect.cells = [...event.cells];
        }
        break;
      }
      case "scoreChanged":
        scoreDelta = event.delta;
        score = event.score;
        break;
      case "comboChanged":
        combo = event.combo;
        break;
      default:
        break;
    }
  }

  const clear = clearPresentation(rows, columns, reducedMotion);
  const clearedCells = clear ? [...clear.cells] : [];

  const rubbleSeen = new Set<string>();
  const rubbleCells: CellPosition[] = [];
  for (const explosion of explosions) {
    for (const cell of explosion.cells) {
      const key = cellKey(cell);
      if (!rubbleSeen.has(key)) {
        rubbleSeen.add(key);
        rubbleCells.push(cell);
      }
    }
  }

  const hasRequiredSequence =
    clearedCells.length > 0 || defuses.length > 0 || explosions.length > 0;

  let durationMs = 0;
  if (hasRequiredSequence) {
    if (reducedMotion) {
      durationMs = clear ? clear.timing.recoveryEndMs : REDUCED_MS;
    } else {
      durationMs = clear?.timing.recoveryEndMs ?? (defuses.length > 0 ? DEFUSE_MS : 0);
      if (explosions.length > 0) {
        durationMs += EXPLOSION_MS;
      }
    }
  }

  let boardImpulse: BoardImpulse | null = null;
  if (!reducedMotion && explosions.length > 0) {
    // Explosion remains visibly stronger than the maximum normal clear. This
    // preserves the established destructive hierarchy without changing its
    // rules, cells, or timing sequence.
    boardImpulse = { source: "explosion", amplitudePx: 8, durationMs: 200 };
  } else if (clear && !reducedMotion) {
    const profile = CLEAR_PROFILES[clear.tier];
    if (profile.impulsePx > 0) {
      boardImpulse = {
        source: "clear",
        amplitudePx: profile.impulsePx,
        durationMs: profile.impulseDurationMs,
      };
    }
  }

  return {
    ...emptyPlan(),
    clear,
    boardImpulse,
    rows,
    columns,
    clearedCells,
    defuses,
    explosions,
    rubbleCells,
    scoreDelta,
    score,
    combo,
    comboReset: combo === 0,
    hasRequiredSequence,
    durationMs,
  };
}

/** Build the plan for an out-of-turn cue (rewarded defuse / revive). The cells
 *  come from the caller's read of authoritative state before the action was
 *  applied. `hasRequiredSequence` stays false because neither action has a
 *  turn-sequenced presentation, so the overlay plays over a board that is
 *  already interactive. */
export function buildCuePlan(
  kind: EffectCueKind,
  cells: readonly CellPosition[],
  reducedMotion: boolean,
): EffectPlan {
  const plan = emptyPlan();
  plan.cue = kind;
  plan.durationMs = reducedMotion ? CUE_REDUCED_MS : CUE_MS;
  if (kind === "revive") {
    plan.reviveCells = [...cells].slice(0, MAX_REVIVE_CELLS);
  } else {
    plan.defuses = [{ pieceId: "", bonus: 0, cells: [...cells] }];
  }
  return plan;
}
