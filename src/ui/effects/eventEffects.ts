import type { GameEvent } from "../../domain/events";
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
};

/** A presentation-only translation of one turn's domain events into the visual
 *  beats to play. It never recomputes gameplay — it only reshapes what the
 *  engine already decided (cleared lines, defuses, explosions, rubble, score,
 *  combo) into cells/among durations for the overlays. */
export type EffectPlan = {
  rows: number[];
  columns: number[];
  /** Deduplicated cells of every cleared row/column (intersections appear
   *  exactly once), in row-major order. */
  clearedCells: CellPosition[];
  defuses: DefuseEffect[];
  explosions: ExplosionEffect[];
  /** Deduplicated union of every explosion's rubble cells, row-major. */
  rubbleCells: CellPosition[];
  scoreDelta: number;
  score: number;
  /** Combo value emitted this turn, or null when unchanged. */
  combo: number | null;
  comboReset: boolean;
  /** True when a clear, defuse, or explosion occurred — the beats that must
   *  lock input until they finish. Plain placements have none. */
  hasRequiredSequence: boolean;
  /** How long the required sequence should hold the input lock, in ms. */
  durationMs: number;
};

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

const REDUCED_MS = 120;
const LINE_CLEAR_MS = 320;
const EXPLOSION_MS = 520;

/** Build the visual plan for a turn's events. Pure: same events (and reduced
 *  flag) always yield the same plan, so ordering, once-only animation, and
 *  intersection dedup are unit-testable without mounting anything. */
export function buildEffectPlan(events: readonly GameEvent[], reducedMotion: boolean): EffectPlan {
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
        defuses.push({ pieceId: event.pieceId, bonus: event.bonus });
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

  const clearedCells = clearedCellsFor(rows, columns, BOARD_SIZE);

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
      durationMs = REDUCED_MS;
    } else {
      durationMs = clearedCells.length > 0 || defuses.length > 0 ? LINE_CLEAR_MS : 0;
      if (explosions.length > 0) {
        durationMs += EXPLOSION_MS;
      }
    }
  }

  return {
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
