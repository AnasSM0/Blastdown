import type { CellPosition } from "../domain/placement";

/** Presentation-only interaction values approved for the B-07 tactile pass. */
export const PICKUP_LIFT_PX = 4;
export const PICKUP_SCALE = 1.06;
export const PICKUP_MS = 120;
export const DRAG_GHOST_OPACITY = 0.35;
export const INVALID_RETURN_MS = 180;
export const PLACEMENT_START_SCALE = 0.85;
export const PLACEMENT_SETTLE_MS = 200;
export const PLACEMENT_CELL_STAGGER_MS = 18;
export const REFILL_TOTAL_MS = 240;
export const REFILL_SLOT_STAGGER_MS = 36;
export const DRAG_HYSTERESIS_RATIO = 0.12;

const TRAY_MIN_SLOT = 58;
const TRAY_MAX_SLOT = 72;
const TRAY_MIN_GAP = 8;
const TRAY_MAX_GAP = 12;
const TRAY_CELL_RATIO = 0.72;
const TRAY_INSET = 10;
const TRAY_CELL_GAP = 2;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export type ShapeBounds = { maxRow: number; maxColumn: number };

export type TrayMetrics = {
  slotSize: number;
  gap: number;
  singleCellSize: number;
  cellGap: number;
  shapeCellSize: (bounds: ShapeBounds) => number;
};

/**
 * Size the three stable tray slots from measured space and the board's actual
 * cell geometry. A single remains visually substantial (72% of a board cell),
 * while larger shapes shrink only as much as required to fit the same slot.
 */
export function trayMetrics(boardCellSize: number, availableWidth: number): TrayMetrics {
  const safeCell = boardCellSize > 0 ? boardCellSize : 36;
  const safeWidth = availableWidth > 0 ? availableWidth : 320;
  const gap = clamp(safeWidth * 0.035, TRAY_MIN_GAP, TRAY_MAX_GAP);
  const widthLimitedSlot = Math.max(0, (safeWidth - gap * 2) / 3);
  const slotSize = Math.min(clamp(safeCell * 1.7, TRAY_MIN_SLOT, TRAY_MAX_SLOT), widthLimitedSlot);
  const singleCellSize = Math.min(safeCell * TRAY_CELL_RATIO, slotSize - TRAY_INSET * 2);

  return {
    slotSize,
    gap,
    singleCellSize,
    cellGap: TRAY_CELL_GAP,
    shapeCellSize: ({ maxRow, maxColumn }) => {
      const longestSide = Math.max(maxRow, maxColumn) + 1;
      const fit = (slotSize - TRAY_INSET * 2 - (longestSide - 1) * TRAY_CELL_GAP) / longestSide;
      return Math.max(8, Math.min(singleCellSize, fit));
    },
  };
}

/** Cell-derived lift: enough thumb clearance without turning into device pixels. */
export function dragLiftForCell(cellSize: number): number {
  return clamp(cellSize * 0.8, 20, 40);
}

export type PlacementSettleStep = {
  cell: CellPosition;
  delayMs: number;
  durationMs: number;
};

/** Row-major order makes a multi-cell settle deterministic across renderers. */
export function placementSettlePlan(
  cells: readonly CellPosition[],
  reducedMotion: boolean,
): PlacementSettleStep[] {
  return [...cells]
    .sort((a, b) => a.row - b.row || a.column - b.column)
    .map((cell, index) => {
      const delayMs = reducedMotion ? 0 : index * PLACEMENT_CELL_STAGGER_MS;
      return {
        cell,
        delayMs,
        durationMs: reducedMotion ? 0 : Math.max(0, PLACEMENT_SETTLE_MS - delayMs),
      };
    });
}

/** Refill is informative but never a gameplay gate; these are animation values only. */
export function refillPlanForSlot(
  slot: number,
  reducedMotion: boolean,
): { delayMs: number; durationMs: number } {
  if (reducedMotion) {
    return { delayMs: 0, durationMs: 0 };
  }
  const delayMs = Math.max(0, slot) * REFILL_SLOT_STAGGER_MS;
  return { delayMs, durationMs: Math.max(0, REFILL_TOTAL_MS - delayMs) };
}
