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
  /** Exact surviving footprint carried by the committed domain event. */
  sourceCells: CellPosition[];
  /** Presentation origin at the source footprint's centroid, in board cells. */
  origin: { row: number; column: number };
  /** Exact newly created rubble reported for this explosion. */
  cells: CellPosition[];
};

export type ExplosionMagnitude = "single" | "double" | "multi";

export type ExplosionTiming = Readonly<{
  criticalFlashEndMs: number;
  detonationStartMs: number;
  detonationEndMs: number;
  fragmentsStartMs: number;
  fragmentsEndMs: number;
  rubbleSettleStartMs: number;
  rubbleSettleEndMs: number;
  recoveryStartMs: number;
  recoveryEndMs: number;
}>;

/** One simultaneous explosion phase derived only from its committed event
 * group. Renderers consume this contract and never infer blast rules from the
 * post-turn grid. Queue identity is attached separately by
 * `identifyExplosionPresentation`. */
export type ExplosionPresentation = Readonly<{
  blasts: readonly ExplosionEffect[];
  sourcePieceIds: readonly string[];
  origins: readonly { row: number; column: number }[];
  affectedCells: readonly CellPosition[];
  newRubbleCells: readonly CellPosition[];
  simultaneousCount: number;
  magnitude: ExplosionMagnitude;
  /** Deliberately exceeds B-05's maximum clear value of 1. */
  bloomIntensity: number;
  timing: ExplosionTiming;
  fragmentCap: number;
}>;

export type IdentifiedExplosionPresentation = ExplosionPresentation &
  Readonly<{
    effectId: string;
    sessionGeneration: number;
    turn: number;
    /** Presentation-only; never reads or advances gameplay RNG. */
    fragmentSeed: number;
    fragments: readonly ExplosionFragment[];
  }>;

export type ExplosionFragment = Readonly<{
  key: string;
  explosionId: string;
  origin: { row: number; column: number };
  targetCell: CellPosition;
  angle: number;
  distanceCells: number;
  delayMs: number;
}>;

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
  explosion: ExplosionPresentation | null;
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
export const MAX_EXPLOSION_FRAGMENTS = MAX_BURST_CELLS;
export const MAX_BOARD_PARTICLES = 40;
export const MAX_REVIVE_CELLS = BOARD_SIZE * BOARD_SIZE;

function cellKey(cell: CellPosition): string {
  return `${cell.row},${cell.column}`;
}

function uniqueCells(cells: readonly CellPosition[]): CellPosition[] {
  const seen = new Set<string>();
  const unique: CellPosition[] = [];
  for (const cell of cells) {
    const key = cellKey(cell);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push({ row: cell.row, column: cell.column });
    }
  }
  unique.sort((a, b) => a.row - b.row || a.column - b.column);
  return unique;
}

function centroid(cells: readonly CellPosition[]): { row: number; column: number } {
  if (cells.length === 0) {
    return { row: 0, column: 0 };
  }
  const total = cells.reduce(
    (sum, cell) => ({ row: sum.row + cell.row, column: sum.column + cell.column }),
    { row: 0, column: 0 },
  );
  return { row: total.row / cells.length, column: total.column / cells.length };
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

const EXPLOSION_TIMING: ExplosionTiming = {
  criticalFlashEndMs: 70,
  detonationStartMs: 40,
  detonationEndMs: 180,
  fragmentsStartMs: 120,
  fragmentsEndMs: 450,
  rubbleSettleStartMs: 250,
  rubbleSettleEndMs: 550,
  recoveryStartMs: 500,
  recoveryEndMs: 800,
};

const REDUCED_EXPLOSION_TIMING: ExplosionTiming = {
  criticalFlashEndMs: 55,
  detonationStartMs: 0,
  detonationEndMs: 95,
  fragmentsStartMs: 0,
  fragmentsEndMs: 0,
  rubbleSettleStartMs: 70,
  rubbleSettleEndMs: 150,
  recoveryStartMs: 120,
  recoveryEndMs: 180,
};

function explosionMagnitude(count: number): ExplosionMagnitude {
  if (count >= 3) return "multi";
  if (count === 2) return "double";
  return "single";
}

export function buildExplosionPresentation(
  explosions: readonly ExplosionEffect[],
  reducedMotion: boolean,
): ExplosionPresentation | null {
  if (explosions.length === 0) {
    return null;
  }
  const newRubbleCells = uniqueCells(explosions.flatMap((explosion) => explosion.cells));
  return {
    blasts: explosions,
    sourcePieceIds: explosions.map((explosion) => explosion.pieceId),
    origins: explosions.map((explosion) => explosion.origin),
    affectedCells: newRubbleCells,
    newRubbleCells,
    simultaneousCount: explosions.length,
    magnitude: explosionMagnitude(explosions.length),
    bloomIntensity: reducedMotion ? 1.02 : explosions.length === 1 ? 1.18 : 1.28,
    timing: reducedMotion ? REDUCED_EXPLOSION_TIMING : EXPLOSION_TIMING,
    fragmentCap: reducedMotion ? 0 : MAX_EXPLOSION_FRAGMENTS,
  };
}

/** Stable 32-bit FNV-1a hash for presentation variation. This never imports or
 * touches the seeded gameplay RNG. */
export function presentationSeed(identity: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function unitFromSeed(seed: number, salt: string): number {
  return presentationSeed(`${seed}:${salt}`) / 0xffffffff;
}

function fragmentsFor(explosion: ExplosionPresentation, fragmentSeed: number): ExplosionFragment[] {
  const fragments: ExplosionFragment[] = [];
  const seen = new Set<string>();
  for (const blast of explosion.blasts) {
    for (const cell of blast.cells) {
      if (fragments.length >= explosion.fragmentCap) {
        return fragments;
      }
      const cellIdentity = cellKey(cell);
      if (seen.has(cellIdentity)) {
        continue;
      }
      seen.add(cellIdentity);
      const rowDelta = cell.row - blast.origin.row;
      const columnDelta = cell.column - blast.origin.column;
      const hasDirection = rowDelta !== 0 || columnDelta !== 0;
      const salt = `${blast.explosionId}:${cellIdentity}`;
      const angle = hasDirection
        ? Math.atan2(rowDelta, columnDelta)
        : unitFromSeed(fragmentSeed, salt) * Math.PI * 2;
      fragments.push({
        key: `fragment-${blast.explosionId}-${cell.row}-${cell.column}`,
        explosionId: blast.explosionId,
        origin: blast.origin,
        targetCell: cell,
        angle,
        distanceCells: 0.65 + unitFromSeed(fragmentSeed, `${salt}:distance`) * 0.55,
        delayMs: Math.min(fragments.length * 9, 96),
      });
    }
  }
  return fragments;
}

export function identifyExplosionPresentation(
  explosion: ExplosionPresentation | null,
  effectId: string,
  sessionGeneration: number,
  turn: number,
): IdentifiedExplosionPresentation | null {
  if (!explosion) {
    return null;
  }
  const fragmentSeed = presentationSeed(effectId);
  return {
    ...explosion,
    effectId,
    sessionGeneration,
    turn,
    fragmentSeed,
    fragments: fragmentsFor(explosion, fragmentSeed),
  };
}

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
    explosion: null,
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
          sourceCells: uniqueCells(event.sourceCells),
          origin: centroid(event.sourceCells),
          cells: [],
        };
        explosions.push(effect);
        explosionsById.set(event.explosionId, effect);
        break;
      }
      case "rubbleCreated": {
        const effect = explosionsById.get(event.explosionId);
        if (effect) {
          effect.cells = uniqueCells(event.cells);
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
  const explosion = buildExplosionPresentation(explosions, reducedMotion);
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
      durationMs = Math.max(
        clear?.timing.recoveryEndMs ?? REDUCED_MS,
        explosion?.timing.recoveryEndMs ?? 0,
      );
    } else {
      durationMs = clear?.timing.recoveryEndMs ?? (defuses.length > 0 ? DEFUSE_MS : 0);
      durationMs = Math.max(durationMs, explosion?.timing.recoveryEndMs ?? 0);
    }
  }

  let boardImpulse: BoardImpulse | null = null;
  if (!reducedMotion && explosion) {
    // Explosion remains visibly stronger than the maximum normal clear. This
    // preserves the established destructive hierarchy without changing its
    // rules, cells, or timing sequence.
    boardImpulse = {
      source: "explosion",
      amplitudePx:
        explosion.magnitude === "single" ? 8 : explosion.magnitude === "double" ? 10 : 12,
      durationMs:
        explosion.magnitude === "single" ? 350 : explosion.magnitude === "double" ? 420 : 500,
    };
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
    explosion,
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
