import type { EffectPlan } from "../../../ui/effects/eventEffects";
import { MAX_BURST_CELLS } from "../../../ui/effects/eventEffects";
import { cellRect, laneRect, rectCenter } from "../geometry";
import type { CinematicPalette, SceneGeometry, SceneRect } from "../types";

/** Transient gameplay effects, as data.
 *
 *  Same discipline as `buildBoardScene`: a pure function turns an authoritative
 *  `EffectPlan` into positioned, timed primitives, and the canvas only advances
 *  a clock over them. Nothing here reads game state, allocates per frame, or
 *  decides gameplay — the plan already did all of that, upstream, from the
 *  domain's own event stream.
 *
 *  Three properties matter and each is tested:
 *
 *  **Reporting, not deciding.** Every primitive is anchored on cells the engine
 *  reported. The rubble a burst plays over is the rubble the domain created; the
 *  cells a sweep crosses are the cells it cleared. An effect can be dropped
 *  without changing a single gameplay outcome, which is what makes capping safe.
 *
 *  **Bounded.** Particles and concurrent effects are capped, using the same
 *  `MAX_BURST_CELLS` budget the React Native overlay already respects, so
 *  several simultaneous expiries cannot multiply into an unbounded cascade.
 *
 *  **Meaning survives reduced motion.** Under reduced motion the travelling
 *  parts go — the sweep's stagger, the burst's outward throw, the ring's growth
 *  — but the EVENT does not. `docs/ACCESSIBILITY.md` is explicit that a cleared
 *  line still flashes and expired rubble is still drawn: what is removed is
 *  movement, never the signal that something happened. */

export type EffectTiming = {
  /** Milliseconds after the sequence starts before this primitive begins. */
  delayMs: number;
  /** How long it plays. */
  durationMs: number;
};

/** A directional energy sweep along a cleared row or column. */
export type SweepPrimitive = EffectTiming & {
  key: string;
  rect: SceneRect;
  orientation: "row" | "column";
  /** Themed sweep colour. Carried on the primitive rather than chosen by the
   *  drawing layer, because a sweep hard-coded to white would be the one beat
   *  in the renderer that ignores the active theme — and it is the largest,
   *  brightest thing on the board when it plays. */
  color: string;
};

/** A cell-level flash: line clears, defused piece cells, revive restoration. */
export type FlashPrimitive = EffectTiming & {
  key: string;
  rect: SceneRect;
  color: string;
  /** Whether the flash may also scale. Cleared under reduced motion. */
  settles: boolean;
};

/** An expanding ring centred on a piece — defuse and revive cues. */
export type RingPrimitive = EffectTiming & {
  key: string;
  center: { x: number; y: number };
  radius: number;
  color: string;
};

/** Debris over an authoritative rubble cell. */
export type BurstPrimitive = EffectTiming & {
  key: string;
  rect: SceneRect;
  color: string;
  /** Direction the debris is thrown, in radians. Zero-length under reduced
   *  motion, where the burst becomes a contained flash. */
  angle: number;
  distance: number;
};

/** A floating score readout. */
export type TextPrimitive = EffectTiming & {
  key: string;
  center: { x: number; y: number };
  text: string;
  color: string;
  /** Vertical travel. Zero under reduced motion. */
  riseBy: number;
};

export type EffectScene = {
  sweeps: readonly SweepPrimitive[];
  flashes: readonly FlashPrimitive[];
  rings: readonly RingPrimitive[];
  bursts: readonly BurstPrimitive[];
  texts: readonly TextPrimitive[];
  /** Board shake amplitude in px; 0 when there is nothing to shake for, or
   *  under reduced motion. Board-only, never the whole screen. */
  shake: number;
  /** Total sequence length, so the canvas knows when to stop drawing. */
  durationMs: number;
};

/** Stagger and duration tuning, matching the React Native overlay's own beats
 *  (`docs/ANIMATION_SPEC.md`, Phase 3) so switching renderers does not change
 *  how long a turn takes to read. */
const CLEAR_STAGGER_MS = 14;
const CLEAR_STAGGER_CAP_MS = 112;
const CLEAR_FLASH_MS = 280;
const SWEEP_MS = 260;
const DEFUSE_RING_MS = 320;
const EXPLOSION_STAGGER_MS = 30;
const EXPLOSION_CELL_STAGGER_MS = 12;
const EXPLOSION_STAGGER_CAP_MS = 120;
const BURST_MS = 360;
const REVIVE_ROW_STAGGER_MS = 18;
const REVIVE_STAGGER_CAP_MS = 140;
const REVIVE_MS = 400;
const TEXT_MS = 900;
const SHAKE_PX = 4;

/** Reduced motion keeps the beat but drops the travel, and shortens it: a
 *  static emphasis that lingers reads as a stall rather than as feedback. */
const REDUCED_FLASH_MS = 140;

const BURST_DISTANCE = 10;

/** Renderer-side caps.
 *
 *  Authoritative gameplay already bounds these — an 8x8 board cannot clear more
 *  than 8 rows, and the domain deduplicates its own event cells. But the
 *  RENDERER should not depend on that: a duplicated or malformed event would
 *  otherwise mount an unbounded number of components on the frame the app is
 *  working hardest. These are backstops, set well above anything real play
 *  produces, so they never truncate a legitimate turn. */
const MAX_SWEEPS = 16;
const MAX_FLASHES = 128;
const MAX_RINGS = 16;

function debrisAngle(row: number, column: number): number {
  // Deterministic, not random: the same cell throws debris the same way every
  // time, so a replayed explosion looks like the same explosion. Two odd
  // multipliers keep neighbouring cells from throwing in parallel.
  return (((row * 7 + column * 13) % 12) / 12) * Math.PI * 2;
}

export function buildEffectScene(
  plan: EffectPlan,
  geometry: SceneGeometry,
  palette: CinematicPalette,
  reducedMotion: boolean,
): EffectScene {
  const sweeps: SweepPrimitive[] = [];
  const flashes: FlashPrimitive[] = [];
  const rings: RingPrimitive[] = [];
  const bursts: BurstPrimitive[] = [];
  const texts: TextPrimitive[] = [];

  if (geometry.cellSize <= 0) {
    return { sweeps, flashes, rings, bursts, texts, shake: 0, durationMs: 0 };
  }

  const flashMs = reducedMotion ? REDUCED_FLASH_MS : CLEAR_FLASH_MS;

  // Line clears. Rows sweep left-to-right and columns top-to-bottom; a cell in
  // both takes the EARLIER delay, so an intersection never flashes twice or
  // waits for the slower of the two lanes.
  if (!reducedMotion) {
    for (const row of plan.rows) {
      if (sweeps.length >= MAX_SWEEPS) {
        break;
      }
      sweeps.push({
        key: `sweep-row-${row}`,
        rect: laneRect(geometry, "row", row),
        orientation: "row",
        color: palette.accent,
        delayMs: 0,
        durationMs: SWEEP_MS,
      });
    }
    for (const column of plan.columns) {
      if (sweeps.length >= MAX_SWEEPS) {
        break;
      }
      sweeps.push({
        key: `sweep-col-${column}`,
        rect: laneRect(geometry, "column", column),
        orientation: "column",
        color: palette.accent,
        delayMs: 0,
        durationMs: SWEEP_MS,
      });
    }
  }

  const clearDelays = new Map<string, number>();
  for (const cell of plan.clearedCells) {
    const key = `${cell.row},${cell.column}`;
    const rowDelay = plan.rows.includes(cell.row)
      ? Math.min(cell.column * CLEAR_STAGGER_MS, CLEAR_STAGGER_CAP_MS)
      : Infinity;
    const columnDelay = plan.columns.includes(cell.column)
      ? Math.min(cell.row * CLEAR_STAGGER_MS, CLEAR_STAGGER_CAP_MS)
      : Infinity;
    const delay = Math.min(rowDelay, columnDelay);
    clearDelays.set(key, Number.isFinite(delay) ? delay : 0);
  }
  for (const cell of plan.clearedCells) {
    flashes.push({
      key: `clear-${cell.row}-${cell.column}`,
      rect: cellRect(geometry, cell.row, cell.column),
      color: palette.accent,
      // Under reduced motion every cleared cell flashes at once, with no
      // settle. The line still reads as cleared; it just does not travel.
      delayMs: reducedMotion ? 0 : (clearDelays.get(`${cell.row},${cell.column}`) ?? 0),
      durationMs: flashMs,
      settles: !reducedMotion,
    });
  }

  // Defuse: the piece's own cells flash, with one contained pulse on its
  // centroid. Never a board-wide effect — a defuse is local by definition.
  for (const defuse of plan.defuses) {
    for (const cell of defuse.cells) {
      if (flashes.length >= MAX_FLASHES) {
        break;
      }
      flashes.push({
        key: `defuse-${defuse.pieceId}-${cell.row}-${cell.column}`,
        rect: cellRect(geometry, cell.row, cell.column),
        color: palette.accent,
        delayMs: 0,
        durationMs: flashMs,
        settles: false,
      });
    }
    if (defuse.cells.length > 0 && rings.length < MAX_RINGS) {
      const rects = defuse.cells.map((cell) => cellRect(geometry, cell.row, cell.column));
      const centers = rects.map(rectCenter);
      rings.push({
        key: `defuse-ring-${defuse.pieceId}`,
        center: {
          x: centers.reduce((sum, c) => sum + c.x, 0) / centers.length,
          y: centers.reduce((sum, c) => sum + c.y, 0) / centers.length,
        },
        radius: reducedMotion ? geometry.cellSize * 0.6 : geometry.cellSize * 1.4,
        color: palette.accent,
        delayMs: 0,
        durationMs: reducedMotion ? REDUCED_FLASH_MS : DEFUSE_RING_MS,
      });
    }
  }

  // Expiry. The burst plays over the rubble the domain actually created, which
  // is why it can be capped without lying: the rubble is drawn by the board
  // regardless, so a dropped burst costs a flourish, not information.
  let burstBudget = MAX_BURST_CELLS;
  // Indexed loops rather than forEach, so an exhausted budget stops the whole
  // traversal. `return` inside a forEach callback only skips one cell, so the
  // previous version kept walking every remaining cell of every remaining
  // explosion long after it could emit anything.
  for (let index = 0; index < plan.explosions.length && burstBudget > 0; index++) {
    const explosion = plan.explosions[index];
    const pieceDelay = Math.min(index * EXPLOSION_STAGGER_MS, EXPLOSION_STAGGER_CAP_MS);
    for (let cellIndex = 0; cellIndex < explosion.cells.length && burstBudget > 0; cellIndex++) {
      const cell = explosion.cells[cellIndex];
      burstBudget -= 1;
      bursts.push({
        key: `burst-${cell.row}-${cell.column}`,
        rect: cellRect(geometry, cell.row, cell.column),
        color: palette.danger,
        angle: debrisAngle(cell.row, cell.column),
        distance: reducedMotion ? 0 : BURST_DISTANCE,
        delayMs: reducedMotion
          ? 0
          : Math.min(
              pieceDelay + cellIndex * EXPLOSION_CELL_STAGGER_MS,
              EXPLOSION_STAGGER_CAP_MS + pieceDelay,
            ),
        durationMs: reducedMotion ? REDUCED_FLASH_MS : BURST_MS,
      });
    }
  }

  // Revive: a restoration wave down the rows the revive gave back, over a board
  // that is already interactive again.
  for (const cell of plan.reviveCells) {
    flashes.push({
      key: `revive-${cell.row}-${cell.column}`,
      rect: cellRect(geometry, cell.row, cell.column),
      color: palette.accent,
      delayMs: reducedMotion
        ? 0
        : Math.min(cell.row * REVIVE_ROW_STAGGER_MS, REVIVE_STAGGER_CAP_MS),
      durationMs: reducedMotion ? REDUCED_FLASH_MS : REVIVE_MS,
      settles: false,
    });
  }

  // Score. Anchored on the event rather than centred on the board, so it never
  // sits over the cells a player is about to place into.
  if (plan.scoreDelta > 0) {
    const anchorCells = plan.clearedCells.length > 0 ? plan.clearedCells : plan.rubbleCells;
    const anchor =
      anchorCells.length > 0
        ? rectCenter(cellRect(geometry, anchorCells[0].row, anchorCells[0].column))
        : rectCenter({ x: 0, y: 0, width: geometry.boardSide, height: geometry.boardSide });
    texts.push({
      key: `score-${plan.scoreDelta}`,
      center: anchor,
      text: `+${plan.scoreDelta}`,
      color: palette.accent,
      riseBy: reducedMotion ? 0 : geometry.cellSize,
      delayMs: 0,
      durationMs: reducedMotion ? REDUCED_FLASH_MS * 2 : TEXT_MS,
    });
  }

  return {
    sweeps,
    flashes,
    rings,
    bursts,
    texts,
    // Board-only, and never under reduced motion — a shake is the one beat with
    // a genuine vestibular cost and no informational content the rubble does
    // not already carry.
    shake: plan.explosions.length > 0 && !reducedMotion ? SHAKE_PX : 0,
    durationMs: plan.durationMs,
  };
}
