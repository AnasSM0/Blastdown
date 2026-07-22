import { render } from "@testing-library/react-native";
import { StyleSheet, type ViewStyle } from "react-native";

import { GameBoard } from "../../src/components/GameBoard";
import { buildEffectPlan } from "../../src/ui/effects/eventEffects";
import type { GridCell } from "../../src/domain/gameTypes";
import type { TimerBadgePlacement } from "../../src/domain/selectors";
import { blockColor, resolveTheme } from "../../src/ui/themes";
import { blockSurface } from "../../src/ui/blockSurface";

const reactor = resolveTheme(undefined);

function fillOf(node: { props: Record<string, unknown> }): unknown {
  return StyleSheet.flatten(node.props.style as ViewStyle)?.backgroundColor;
}

function makeEmptyGrid(size: number): GridCell[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, (): GridCell => ({ kind: "empty" })),
  );
}

describe("GameBoard", () => {
  it("renders exactly 64 cells", async () => {
    const result = await render(<GameBoard grid={makeEmptyGrid(8)} badges={[]} boardSize={328} />);
    expect(result.getAllByTestId(/^cell-\d+-\d+$/)).toHaveLength(64);
  });

  it("stays square and renders the decorative frame layers without covering cells (P1-3)", async () => {
    const result = await render(<GameBoard grid={makeEmptyGrid(8)} badges={[]} boardSize={328} />);
    // Board is square (1:1) at every width.
    const board = StyleSheet.flatten(result.getByTestId("game-board").props.style);
    expect(board.aspectRatio).toBe(1);
    // Frame depth is present…
    expect(result.getByTestId("board-frame-inner")).toBeTruthy();
    expect(result.getByTestId("board-frame-corners")).toBeTruthy();
    // …and purely decorative — the inner ring and corner layer never intercept
    // touches, so the 64 cells behind them stay fully interactive.
    expect(result.getByTestId("board-frame-inner").props.pointerEvents).toBe("none");
    expect(result.getByTestId("board-frame-corners").props.pointerEvents).toBe("none");
    expect(result.getAllByTestId(/^cell-\d+-\d+$/)).toHaveLength(64);
  });

  it("renders timed, normal, and rubble cells distinctly via accessibility labels", async () => {
    const grid = makeEmptyGrid(8);
    grid[1][1] = { kind: "timed", pieceInstanceId: "p1", colorId: "cyan" };
    grid[2][2] = { kind: "normal", colorId: "amber" };
    grid[3][3] = { kind: "rubble", explosionId: "e1" };

    const result = await render(<GameBoard grid={grid} badges={[]} boardSize={328} />);

    expect(result.getByLabelText(/cyan block.*row 2.*column 2/i)).toBeTruthy();
    expect(result.getByLabelText(/amber block.*row 3.*column 3/i)).toBeTruthy();
    expect(result.getByLabelText(/rubble.*row 4.*column 4/i)).toBeTruthy();
  });

  it("renders exactly one timer badge per timed piece with its digit", async () => {
    const grid = makeEmptyGrid(8);
    // One 3-cell piece and one single-cell piece.
    grid[0][0] = { kind: "timed", pieceInstanceId: "a", colorId: "cyan" };
    grid[0][1] = { kind: "timed", pieceInstanceId: "a", colorId: "cyan" };
    grid[1][0] = { kind: "timed", pieceInstanceId: "a", colorId: "cyan" };
    grid[5][5] = { kind: "timed", pieceInstanceId: "b", colorId: "purple" };
    const badges: TimerBadgePlacement[] = [
      { pieceId: "a", position: { row: 0, column: 0 }, remainingTurns: 6, colorId: "cyan" },
      { pieceId: "b", position: { row: 5, column: 5 }, remainingTurns: 1, colorId: "purple" },
    ];

    const result = await render(<GameBoard grid={grid} badges={badges} boardSize={328} />);

    expect(result.getAllByTestId(/^timer-badge-/)).toHaveLength(2);
    expect(result.getByText("6")).toBeTruthy();
    expect(result.getByText("1")).toBeTruthy();
  });

  it("applies the critical block material only to urgent timed pieces (P1-4)", async () => {
    const grid = makeEmptyGrid(8);
    grid[0][0] = { kind: "timed", pieceInstanceId: "urgent", colorId: "cyan" };
    grid[5][5] = { kind: "timed", pieceInstanceId: "calm", colorId: "cyan" };
    const badges: TimerBadgePlacement[] = [
      { pieceId: "urgent", position: { row: 0, column: 0 }, remainingTurns: 1, colorId: "cyan" },
      { pieceId: "calm", position: { row: 5, column: 5 }, remainingTurns: 6, colorId: "cyan" },
    ];

    const result = await render(<GameBoard grid={grid} badges={badges} boardSize={328} />);

    const accent = blockColor(reactor, "cyan");
    expect(fillOf(result.getByTestId("block-0-0"))).toBe(
      blockSurface(reactor, accent, "critical").fill,
    );
    expect(fillOf(result.getByTestId("block-5-5"))).toBe(
      blockSurface(reactor, accent, "normal").fill,
    );
  });

  it("draws a piece contour only on timed cells, following existing piece metadata (P1-5)", async () => {
    const grid = makeEmptyGrid(8);
    // A 2-cell horizontal timed piece and an unrelated normal block.
    grid[0][0] = { kind: "timed", pieceInstanceId: "a", colorId: "cyan" };
    grid[0][1] = { kind: "timed", pieceInstanceId: "a", colorId: "cyan" };
    grid[3][3] = { kind: "normal", colorId: "amber" };

    const result = await render(<GameBoard grid={grid} badges={[]} boardSize={328} />);

    // Both timed cells get a contour; the normal block and empty cells do not.
    expect(result.getByTestId("contour-0-0")).toBeTruthy();
    expect(result.getByTestId("contour-0-1")).toBeTruthy();
    expect(result.queryByTestId("contour-3-3")).toBeNull();
    expect(result.queryByTestId("contour-5-5")).toBeNull();

    // The shared side between the two cells is internal, so it is not stroked:
    // cell (0,0)'s right edge and cell (0,1)'s left edge carry no border width.
    const left = StyleSheet.flatten(result.getByTestId("contour-0-0").props.style) as ViewStyle;
    const right = StyleSheet.flatten(result.getByTestId("contour-0-1").props.style) as ViewStyle;
    expect(left.borderRightWidth).toBe(0);
    expect(left.borderLeftWidth).toBeGreaterThan(0);
    expect(right.borderLeftWidth).toBe(0);
    expect(right.borderRightWidth).toBeGreaterThan(0);
  });

  it("puts every timer badge into the frozen cue while freeze is active (P1-5)", async () => {
    const grid = makeEmptyGrid(8);
    grid[0][0] = { kind: "timed", pieceInstanceId: "a", colorId: "cyan" };
    const badges: TimerBadgePlacement[] = [
      { pieceId: "a", position: { row: 0, column: 0 }, remainingTurns: 1, colorId: "cyan" },
    ];

    const result = await render(<GameBoard grid={grid} badges={badges} boardSize={328} frozen />);

    expect(result.getByTestId("timer-badge-a").props.accessibilityHint).toMatch(/frozen/i);
  });

  it("labels the board for screen readers", async () => {
    const result = await render(<GameBoard grid={makeEmptyGrid(8)} badges={[]} boardSize={328} />);
    expect(result.getByLabelText(/game board/i)).toBeTruthy();
  });

  it("renders the explosion effect overlay over the rubble it produced", async () => {
    const grid = makeEmptyGrid(8);
    grid[4][4] = { kind: "rubble", explosionId: "e-1" };
    const plan = buildEffectPlan(
      [
        { type: "explosionStarted", explosionId: "e-1", pieceId: "piece-1" },
        { type: "rubbleCreated", explosionId: "e-1", cells: [{ row: 4, column: 4 }] },
        { type: "scoreChanged", delta: -50, score: 0 },
      ],
      false,
    );

    const result = await render(
      <GameBoard grid={grid} badges={[]} boardSize={328} effectPlan={plan} effectKey={1} />,
    );

    // The rubble cell is drawn by the grid, and the burst overlay sits on top.
    expect(result.getByLabelText(/rubble.*row 5.*column 5/i)).toBeTruthy();
    expect(result.getByTestId("effects-layer")).toBeTruthy();
    expect(result.getAllByTestId("burst-cell")).toHaveLength(1);
  });
});
