import {
  identifyExplosionPresentation,
  buildExplosionPresentation,
  MAX_BOARD_PARTICLES,
  type EffectPlan,
  type IdentifiedExplosionPresentation,
} from "../../../ui/effects/eventEffects";
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
  /** Tier-scaled peak without multiplying sweep primitives. */
  peak: number;
};

/** A contained lane glow spanning impact through recovery. */
export type BloomPrimitive = EffectTiming & {
  key: string;
  rect: SceneRect;
  color: string;
  peak: number;
};

/** A cell-level flash: line clears, defused piece cells, revive restoration. */
export type FlashPrimitive = EffectTiming & {
  key: string;
  rect: SceneRect;
  color: string;
  /** Whether the flash may also scale. Cleared under reduced motion. */
  settles: boolean;
  peak: number;
  /** A clear reuses one primitive for impact and release instead of mounting
   * two flashes for every cell. Absent for defuse/revive flashes. */
  clearTimeline?: Readonly<{
    impactEndMs: number;
    releaseStartMs: number;
    releaseEndMs: number;
  }>;
};

/** An expanding ring centred on a piece — defuse and revive cues. */
export type RingPrimitive = EffectTiming & {
  key: string;
  center: { x: number; y: number };
  radius: number;
  color: string;
};

export type DetonationPrimitive = EffectTiming & {
  key: string;
  center: { x: number; y: number };
  radius: number;
  color: string;
  peak: number;
  expands: boolean;
};

export type ShockwavePrimitive = EffectTiming & {
  key: string;
  center: { x: number; y: number };
  radius: number;
  color: string;
  peak: number;
  expands: boolean;
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
  blooms: readonly BloomPrimitive[];
  sweeps: readonly SweepPrimitive[];
  flashes: readonly FlashPrimitive[];
  rings: readonly RingPrimitive[];
  detonations: readonly DetonationPrimitive[];
  shockwaves: readonly ShockwavePrimitive[];
  rubbleImpacts: readonly FlashPrimitive[];
  bursts: readonly BurstPrimitive[];
  texts: readonly TextPrimitive[];
  /** Board shake amplitude in px; 0 when there is nothing to shake for, or
   *  under reduced motion. Board-only, never the whole screen. */
  shake: number;
  shakeDurationMs: number;
  /** Total sequence length, so the canvas knows when to stop drawing. */
  durationMs: number;
};

/** Stagger and duration tuning, matching the React Native overlay's own beats
 *  (`docs/ANIMATION_SPEC.md`, Phase 3) so switching renderers does not change
 *  how long a turn takes to read. */
const CLEAR_STAGGER_MS = 8;
const CLEAR_STAGGER_CAP_MS = 56;
const CLEAR_FLASH_MS = 280;
const DEFUSE_RING_MS = 320;
const REVIVE_ROW_STAGGER_MS = 18;
const REVIVE_STAGGER_CAP_MS = 140;
const REVIVE_MS = 400;
const TEXT_MS = 900;

/** Reduced motion keeps the beat but drops the travel, and shortens it: a
 *  static emphasis that lingers reads as a stall rather than as feedback. */
const REDUCED_FLASH_MS = 140;

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

export function buildEffectScene(
  plan: EffectPlan,
  geometry: SceneGeometry,
  palette: CinematicPalette,
  reducedMotion: boolean,
  identifiedExplosion?: IdentifiedExplosionPresentation | null,
  fragmentLimit = MAX_BOARD_PARTICLES,
): EffectScene {
  const sweeps: SweepPrimitive[] = [];
  const blooms: BloomPrimitive[] = [];
  const flashes: FlashPrimitive[] = [];
  const rings: RingPrimitive[] = [];
  const detonations: DetonationPrimitive[] = [];
  const shockwaves: ShockwavePrimitive[] = [];
  const rubbleImpacts: FlashPrimitive[] = [];
  const bursts: BurstPrimitive[] = [];
  const texts: TextPrimitive[] = [];

  if (geometry.cellSize <= 0) {
    return {
      blooms,
      sweeps,
      flashes,
      rings,
      detonations,
      shockwaves,
      rubbleImpacts,
      bursts,
      texts,
      shake: 0,
      shakeDurationMs: 0,
      durationMs: 0,
    };
  }

  const flashMs = reducedMotion ? REDUCED_FLASH_MS : CLEAR_FLASH_MS;

  const clear = plan.clear;

  // Line clears. Rows sweep left-to-right and columns top-to-bottom; a cell in
  // both takes the EARLIER delay, so an intersection never flashes twice or
  // waits for the slower of the two lanes.
  if (clear) {
    for (const row of clear.rows) {
      blooms.push({
        key: `bloom-row-${row}`,
        rect: laneRect(geometry, "row", row),
        color: palette.accent,
        peak: clear.bloomIntensity * 0.22,
        delayMs: clear.timing.impactStartMs,
        durationMs: clear.timing.recoveryEndMs,
      });
    }
    for (const column of clear.columns) {
      blooms.push({
        key: `bloom-col-${column}`,
        rect: laneRect(geometry, "column", column),
        color: palette.accent,
        peak: clear.bloomIntensity * 0.22,
        delayMs: clear.timing.impactStartMs,
        durationMs: clear.timing.recoveryEndMs,
      });
    }
  }

  if (clear && !reducedMotion) {
    for (const row of clear.rows) {
      if (sweeps.length >= MAX_SWEEPS) {
        break;
      }
      sweeps.push({
        key: `sweep-row-${row}`,
        rect: laneRect(geometry, "row", row),
        orientation: "row",
        color: palette.accent,
        peak: Math.min(1, 0.62 + clear.bloomIntensity * 0.3),
        delayMs: clear.timing.sweepStartMs,
        durationMs: clear.timing.sweepEndMs - clear.timing.sweepStartMs,
      });
    }
    for (const column of clear.columns) {
      if (sweeps.length >= MAX_SWEEPS) {
        break;
      }
      sweeps.push({
        key: `sweep-col-${column}`,
        rect: laneRect(geometry, "column", column),
        orientation: "column",
        color: palette.accent,
        peak: Math.min(1, 0.62 + clear.bloomIntensity * 0.3),
        delayMs: clear.timing.sweepStartMs,
        durationMs: clear.timing.sweepEndMs - clear.timing.sweepStartMs,
      });
    }
  }

  if (clear) {
    const clearDelays = new Map<string, number>();
    for (const cell of clear.cells) {
      const key = `${cell.row},${cell.column}`;
      const rowDelay = clear.rows.includes(cell.row)
        ? Math.min(cell.column * CLEAR_STAGGER_MS, CLEAR_STAGGER_CAP_MS)
        : Infinity;
      const columnDelay = clear.columns.includes(cell.column)
        ? Math.min(cell.row * CLEAR_STAGGER_MS, CLEAR_STAGGER_CAP_MS)
        : Infinity;
      const delay = Math.min(rowDelay, columnDelay);
      clearDelays.set(key, Number.isFinite(delay) ? delay : 0);
    }
    const intersections = new Set(clear.intersections.map((cell) => `${cell.row},${cell.column}`));
    for (const cell of clear.cells) {
      const cellKey = `${cell.row},${cell.column}`;
      const releaseDelay = reducedMotion ? 0 : (clearDelays.get(cellKey) ?? 0);
      const intersection = intersections.has(cellKey);
      flashes.push({
        key: `clear-${cell.row}-${cell.column}`,
        rect: cellRect(geometry, cell.row, cell.column),
        color: palette.accent,
        delayMs: 0,
        durationMs: clear.timing.releaseEndMs,
        settles: !reducedMotion,
        peak: Math.min(1, 0.58 + clear.bloomIntensity * 0.3 + (intersection ? 0.12 : 0)),
        clearTimeline: {
          impactEndMs: clear.timing.impactEndMs,
          releaseStartMs: clear.timing.releaseStartMs + releaseDelay,
          releaseEndMs: clear.timing.releaseEndMs,
        },
      });
    }
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
        peak: 1,
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

  const explosion =
    identifiedExplosion ??
    identifyExplosionPresentation(
      plan.explosion ?? buildExplosionPresentation(plan.explosions, reducedMotion),
      "standalone",
      0,
      0,
    );
  if (explosion) {
    const { timing } = explosion;
    for (const blast of explosion.blasts) {
      const sourceRects = blast.sourceCells.map((cell) =>
        cellRect(geometry, cell.row, cell.column),
      );
      for (const [index, rect] of sourceRects.entries()) {
        flashes.push({
          key: `explosion-critical-${blast.explosionId}-${index}`,
          rect,
          color: palette.danger,
          delayMs: 0,
          durationMs: timing.criticalFlashEndMs,
          settles: false,
          peak: 1,
        });
      }
      const center = {
        x: geometry.contentInset + blast.origin.column * geometry.pitch + geometry.cellSize / 2,
        y: geometry.contentInset + blast.origin.row * geometry.pitch + geometry.cellSize / 2,
      };
      detonations.push({
        key: `explosion-detonation-${blast.explosionId}`,
        center,
        radius: geometry.cellSize * 1.4,
        color: palette.danger,
        peak: Math.min(1, explosion.bloomIntensity * 0.78),
        expands: !reducedMotion,
        delayMs: timing.detonationStartMs,
        durationMs: Math.max(1, timing.detonationEndMs - timing.detonationStartMs),
      });
      shockwaves.push({
        key: `explosion-shockwave-${blast.explosionId}`,
        center,
        radius: geometry.cellSize * 2.15,
        color: palette.danger,
        peak: 0.95,
        expands: !reducedMotion,
        delayMs: timing.detonationStartMs,
        durationMs: Math.max(
          1,
          (timing.fragmentsEndMs > timing.detonationStartMs
            ? timing.fragmentsEndMs
            : timing.recoveryEndMs) - timing.detonationStartMs,
        ),
      });
    }

    for (const cell of explosion.newRubbleCells) {
      rubbleImpacts.push({
        key: `rubble-impact-${cell.row}-${cell.column}`,
        rect: cellRect(geometry, cell.row, cell.column),
        color: palette.danger,
        delayMs: timing.rubbleSettleStartMs,
        durationMs: Math.max(1, timing.rubbleSettleEndMs - timing.rubbleSettleStartMs),
        settles: !reducedMotion,
        peak: reducedMotion ? 0.55 : 0.82,
      });
    }

    if (!reducedMotion) {
      for (const fragment of explosion.fragments.slice(0, fragmentLimit)) {
        const size = Math.max(2, geometry.cellSize * 0.12);
        bursts.push({
          key: fragment.key,
          rect: {
            x:
              geometry.contentInset +
              fragment.origin.column * geometry.pitch +
              geometry.cellSize / 2 -
              size / 2,
            y:
              geometry.contentInset +
              fragment.origin.row * geometry.pitch +
              geometry.cellSize / 2 -
              size / 2,
            width: size * 2.2,
            height: size,
          },
          color: palette.danger,
          angle: fragment.angle,
          distance: geometry.cellSize * fragment.distanceCells,
          delayMs: timing.fragmentsStartMs + fragment.delayMs,
          durationMs: Math.max(
            1,
            timing.fragmentsEndMs - timing.fragmentsStartMs - fragment.delayMs,
          ),
        });
      }
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
      peak: 1,
    });
  }

  // Score. Anchored on the event rather than centred on the board, so it never
  // sits over the cells a player is about to place into.
  if (plan.scoreDelta > 0) {
    const clearCells = plan.clear?.cells ?? [];
    const anchorCells = clearCells.length > 0 ? clearCells : plan.rubbleCells;
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
    blooms,
    sweeps,
    flashes,
    rings,
    detonations,
    shockwaves,
    rubbleImpacts,
    bursts,
    texts,
    // Board-only, and never under reduced motion — a shake is the one beat with
    // a genuine vestibular cost and no informational content the rubble does
    // not already carry.
    shake: reducedMotion ? 0 : (plan.boardImpulse?.amplitudePx ?? 0),
    shakeDurationMs: reducedMotion ? 0 : (plan.boardImpulse?.durationMs ?? 0),
    durationMs: plan.durationMs,
  };
}
