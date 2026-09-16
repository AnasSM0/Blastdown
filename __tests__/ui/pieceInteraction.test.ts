import {
  DRAG_GHOST_OPACITY,
  INVALID_RETURN_MS,
  PICKUP_LIFT_PX,
  PICKUP_MS,
  PICKUP_SCALE,
  PLACEMENT_SETTLE_MS,
  REFILL_TOTAL_MS,
  dragLiftForCell,
  placementSettlePlan,
  refillPlanForSlot,
  trayMetrics,
} from "../../src/ui/pieceInteraction";
import {
  dragOriginFromFinger,
  fingerPointForDragOrigin,
  stableDragOriginFromFinger,
  type BoardLayout,
} from "../../src/ui/boardGeometry";

const layout: BoardLayout = {
  contentLeft: 20,
  contentTop: 40,
  cellSize: 36,
  pitch: 38,
  size: 8,
};

describe("piece interaction presentation contract", () => {
  it("uses the approved immediate pickup, ghost, rejection, and settle timing", () => {
    expect(PICKUP_LIFT_PX).toBe(4);
    expect(PICKUP_SCALE).toBe(1.06);
    expect(PICKUP_MS).toBe(120);
    expect(DRAG_GHOST_OPACITY).toBeCloseTo(0.35);
    expect(INVALID_RETURN_MS).toBe(180);
    expect(PLACEMENT_SETTLE_MS).toBeGreaterThanOrEqual(180);
    expect(PLACEMENT_SETTLE_MS).toBeLessThanOrEqual(220);
    expect(REFILL_TOTAL_MS).toBeGreaterThanOrEqual(200);
    expect(REFILL_TOTAL_MS).toBeLessThanOrEqual(300);
  });

  it.each([
    [320, 34],
    [360, 39],
    [412, 45],
  ])("keeps three adaptive tray slots usable at %ipx", (availableWidth, boardCellSize) => {
    const metrics = trayMetrics(boardCellSize, availableWidth);
    expect(metrics.slotSize * 3 + metrics.gap * 2).toBeLessThanOrEqual(availableWidth);
    expect(metrics.singleCellSize / boardCellSize).toBeGreaterThanOrEqual(0.65);
    expect(metrics.singleCellSize / boardCellSize).toBeLessThanOrEqual(0.8);
    expect(metrics.shapeCellSize({ maxRow: 2, maxColumn: 2 })).toBeLessThanOrEqual(
      metrics.singleCellSize,
    );
  });

  it("derives the visual drag lift from cell geometry and clamps extreme layouts", () => {
    expect(dragLiftForCell(20)).toBe(20);
    expect(dragLiftForCell(36)).toBeGreaterThan(20);
    expect(dragLiftForCell(80)).toBe(40);
  });

  it("orders a multi-cell settle deterministically while every cell finishes together", () => {
    const cells = [
      { row: 2, column: 4 },
      { row: 1, column: 5 },
      { row: 1, column: 4 },
    ];
    expect(placementSettlePlan(cells, false)).toEqual([
      { cell: { row: 1, column: 4 }, delayMs: 0, durationMs: PLACEMENT_SETTLE_MS },
      { cell: { row: 1, column: 5 }, delayMs: 18, durationMs: PLACEMENT_SETTLE_MS - 18 },
      { cell: { row: 2, column: 4 }, delayMs: 36, durationMs: PLACEMENT_SETTLE_MS - 36 },
    ]);
    expect(placementSettlePlan(cells, true).every((step) => step.delayMs === 0)).toBe(true);
  });

  it("uses a restrained nonblocking refill stagger and removes it for reduced motion", () => {
    expect([0, 1, 2].map((slot) => refillPlanForSlot(slot, false))).toEqual([
      { delayMs: 0, durationMs: REFILL_TOTAL_MS },
      { delayMs: 36, durationMs: REFILL_TOTAL_MS - 36 },
      { delayMs: 72, durationMs: REFILL_TOTAL_MS - 72 },
    ]);
    expect(refillPlanForSlot(2, true)).toEqual({ delayMs: 0, durationMs: 0 });
  });
});

describe("drag coordinate continuity", () => {
  const bounds = { maxRow: 1, maxColumn: 2 };

  it("keeps visual lift separate from the logical anchor across cell sizes", () => {
    const origin = { row: 3, column: 2 };
    for (const cellSize of [28, 36, 48]) {
      const responsiveLayout = {
        ...layout,
        cellSize,
        pitch: cellSize + 2,
      };
      const lift = dragLiftForCell(cellSize);
      const point = fingerPointForDragOrigin(origin, bounds, lift, responsiveLayout);
      expect(dragOriginFromFinger(point, bounds, lift, responsiveLayout)).toEqual(origin);
    }
  });

  it("holds an anchor through boundary noise but moves after a deliberate crossing", () => {
    const single = { maxRow: 0, maxColumn: 0 };
    const lift = dragLiftForCell(layout.cellSize);
    const previous = { row: 2, column: 2 };
    const boundaryX = layout.contentLeft + 3 * layout.pitch;
    const y = fingerPointForDragOrigin(previous, single, lift, layout).y;

    expect(
      stableDragOriginFromFinger({ x: boundaryX + 1, y }, single, lift, layout, previous),
    ).toEqual(previous);
    expect(
      stableDragOriginFromFinger(
        { x: boundaryX + layout.pitch * 0.2, y },
        single,
        lift,
        layout,
        previous,
      ),
    ).toEqual({ row: 2, column: 3 });
  });
});
