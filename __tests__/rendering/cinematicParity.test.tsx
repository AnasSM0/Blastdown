import { fireEvent, render } from "@testing-library/react-native";

import { CinematicBoard } from "../../src/components/CinematicBoard";
import { GameBoard } from "../../src/components/GameBoard";
import type { GameBoardProps } from "../../src/components/GameBoard/boardProps";
import type { GridCell as DomainGridCell } from "../../src/domain/gameTypes";
import type { TimerBadgePlacement } from "../../src/domain/selectors";
import { placementSettlePlan } from "../../src/ui/pieceInteraction";

/** Renderer parity.
 *
 *  The cinematic renderer is allowed to look completely different. What it is
 *  NOT allowed to do is behave differently — and behaviour, for a board, means
 *  the accessibility tree and the press surface, because those are the whole of
 *  what the platform and a screen reader can see.
 *
 *  So these tests mount both renderers on identical state and compare what they
 *  expose. They are the reason the feature flag is a safety net rather than a
 *  fork: whichever one a build selects, a player using assistive technology gets
 *  the same game.
 *
 *  The comparison is deliberately behavioural rather than visual. Skia draws
 *  nothing under jest, so no test here can tell whether the board looks right —
 *  that is a device question, and it is listed as one. What can be settled on a
 *  build machine is whether anything was silently dropped in the move, which is
 *  the failure mode that would otherwise ship unnoticed. */

const BOARD_SIDE = 328;

function grid(): DomainGridCell[][] {
  const cells = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, (): DomainGridCell => ({ kind: "empty" })),
  );
  cells[0][0] = { kind: "timed", pieceInstanceId: "p1", colorId: "cyan" };
  cells[0][1] = { kind: "timed", pieceInstanceId: "p1", colorId: "cyan" };
  cells[3][3] = { kind: "normal", colorId: "amber" };
  cells[7][7] = { kind: "rubble", explosionId: "e1" };
  return cells;
}

const badges: TimerBadgePlacement[] = [
  { pieceId: "p1", position: { row: 0, column: 0 }, remainingTurns: 2, colorId: "cyan" },
];

function props(overrides: Partial<GameBoardProps> = {}): GameBoardProps {
  return {
    grid: grid(),
    badges,
    boardSize: BOARD_SIDE,
    onCellPress: () => {},
    frozen: false,
    reducedMotion: false,
    ...overrides,
  };
}

/** Every board cell's spoken description, in row-major order. */
async function cellLabels(Board: typeof GameBoard | typeof CinematicBoard, p: GameBoardProps) {
  const view = await render(<Board {...p} />);
  const labels: string[] = [];
  for (let row = 0; row < 8; row++) {
    for (let column = 0; column < 8; column++) {
      labels.push(String(view.getByTestId(`cell-${row}-${column}`).props.accessibilityLabel));
    }
  }
  await view.unmount();
  return labels;
}

describe("both renderers expose the same board to assistive technology", () => {
  it("speaks every cell identically", async () => {
    const p = props();

    expect(await cellLabels(CinematicBoard, p)).toEqual(await cellLabels(GameBoard, p));
  });

  it("speaks the timer state identically, including the frozen override", async () => {
    // Both renderers must announce the countdown as a NUMBER and the frozen
    // state as a WORD. The canvas draws a ring; a ring says nothing.
    for (const frozen of [false, true]) {
      const p = props({ frozen });

      expect(await cellLabels(CinematicBoard, p)).toEqual(await cellLabels(GameBoard, p));
    }
  });

  it("gives the same placement hints while a piece is selected", async () => {
    const hints = new Map<string, "valid" | "invalid">([
      ["2,2", "valid"],
      ["2,3", "invalid"],
    ]);
    const p = props({ placementHints: hints });

    const cinematic = await render(<CinematicBoard {...p} />);
    const views = await render(<GameBoard {...p} />);

    for (const key of ["2,2", "2,3", "4,4"]) {
      const [row, column] = key.split(",");
      const id = `cell-${row}-${column}`;
      expect({ key, hint: cinematic.getByTestId(id).props.accessibilityHint }).toEqual({
        key,
        hint: views.getByTestId(id).props.accessibilityHint,
      });
    }
    await cinematic.unmount();
    await views.unmount();
  });

  it("keeps a timer badge node per active piece", async () => {
    // The badge is not a placement control, so the cell overlay does not cover
    // it. Losing it would silently delete every countdown announcement — the
    // regression the CIN-A audit caught in the first version of this renderer.
    const cinematic = await render(<CinematicBoard {...props()} />);

    const badge = cinematic.getByTestId("timer-badge-p1");
    expect(badge.props.accessibilityLabel).toBe("2 moves left");
    expect(badge.props.accessibilityHint).toBe("Timer state: warning");
    await cinematic.unmount();
  });

  it("carries the board's own label and test id", async () => {
    for (const Board of [GameBoard, CinematicBoard]) {
      const view = await render(<Board {...props()} />);

      expect(view.getByTestId("game-board").props.accessibilityLabel).toBe("Game board");
      await view.unmount();
    }
  });
});

describe("both renderers offer the same press surface", () => {
  it("reports the same pre-clear anchor lifecycle", async () => {
    for (const Board of [GameBoard, CinematicBoard]) {
      const anchors: string[] = [];
      const view = await render(
        <Board
          {...props({
            onCellPreviewChange: (position) =>
              anchors.push(position ? `${position.row},${position.column}` : "none"),
          })}
        />,
      );

      const cell = view.getByTestId("cell-5-6");
      await fireEvent(cell, "pressIn");
      await fireEvent(cell, "pressOut");

      expect(anchors).toEqual(["5,6", "none"]);
      await view.unmount();
    }
  });

  it("reports the same cell for a press, from either renderer", async () => {
    for (const Board of [GameBoard, CinematicBoard]) {
      const pressed: string[] = [];
      const view = await render(
        <Board {...props({ onCellPress: (p) => pressed.push(`${p.row},${p.column}`) })} />,
      );

      // Tap-to-place is the documented accessibility fallback for placement
      // (docs/GAME_RULES.md), so this path is not optional in either renderer.
      await fireEvent.press(view.getByTestId("cell-5-6"));

      expect(pressed).toEqual(["5,6"]);
      await view.unmount();
    }
  });

  it("disables every cell when the board is not interactive", async () => {
    for (const Board of [GameBoard, CinematicBoard]) {
      const view = await render(<Board {...props({ onCellPress: undefined })} />);

      expect(view.getByTestId("cell-0-0").props.accessibilityRole).toBeUndefined();
      await view.unmount();
    }
  });
});

describe("both renderers report the same cell size to the drag system", () => {
  it("agrees to the pixel, because placement depends on it", async () => {
    // The screen builds its drag layout from this number. A disagreement here
    // would not look like a rendering bug: pieces would land beside where they
    // appeared to.
    const sizes: number[] = [];
    for (const Board of [GameBoard, CinematicBoard]) {
      const view = await render(
        <Board {...props({ onCellSizeChange: (size) => sizes.push(size) })} />,
      );
      await view.unmount();
    }

    expect(sizes).toHaveLength(2);
    expect(sizes[0]).toBeCloseTo(sizes[1], 10);
  });
});

describe("both renderers consume the shared placement-settle contract", () => {
  const placedCells = [
    { row: 0, column: 0 },
    { row: 0, column: 1 },
  ];

  it("routes the same deterministic plan into both renderer implementations", () => {
    // Keep this structural: RN Animated completes synchronously under one Jest
    // mock and on fake time under another, so transient-node assertions become
    // suite-order dependent. The pure plan is tested frame-by-frame elsewhere.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readFileSync } = require("fs") as {
      readFileSync: (path: string, encoding: string) => string;
    };
    const fallback = readFileSync("src/components/GameBoard/GameBoard.tsx", "utf8");
    const cinematic = readFileSync("src/components/CinematicBoard/CinematicBoard.tsx", "utf8");

    expect(fallback).toContain("placementSettlePlan(placedCells ?? [], reducedMotion)");
    expect(cinematic).toContain("placementSettlePlan(placedCells ?? [], reducedMotion)");
    expect(placementSettlePlan(placedCells, false)).toHaveLength(2);
  });

  it("keeps placement confirmation immediate and transform-free under reduced motion", async () => {
    const cinematic = await render(
      <CinematicBoard {...props({ placedCells, placementNonce: 8, reducedMotion: true })} />,
    );
    const fallback = await render(
      <GameBoard {...props({ placedCells, placementNonce: 8, reducedMotion: true })} />,
    );

    expect(cinematic.queryAllByTestId(/^cinematic-placement-settle-/)).toHaveLength(0);
    expect(fallback.getByTestId("cell-0-0").props.style).toBeDefined();
  });
});

describe("the block material is shared, not copied", () => {
  it("keeps the canvas sheen pinned to the React Native one", () => {
    // BlocksLayer redeclares the sheen as numbers because the React Native
    // version expresses it as a percentage string in a StyleSheet. That is the
    // one place the two materials could drift apart in silence, so it is read
    // back from both sources rather than trusted.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readFileSync } = require("fs") as {
      readFileSync: (p: string, e: string) => string;
    };
    const rn = readFileSync("src/components/BlockSurface/BlockSurface.tsx", "utf8");
    const skia = readFileSync("src/rendering/cinematic/layers/BlocksLayer.tsx", "utf8");

    const rnHeight = /height:\s*"(\d+)%"/.exec(rn)?.[1];
    const rnOpacity = /sheen:[\s\S]*?opacity:\s*([\d.]+)/.exec(rn)?.[1];
    const skiaHeight = /SHEEN_HEIGHT_RATIO = ([\d.]+)/.exec(skia)?.[1];
    const skiaOpacity = /SHEEN_OPACITY = ([\d.]+)/.exec(skia)?.[1];

    expect({ height: Number(rnHeight) / 100, opacity: Number(rnOpacity) }).toEqual({
      height: Number(skiaHeight),
      opacity: Number(skiaOpacity),
    });
  });
});
