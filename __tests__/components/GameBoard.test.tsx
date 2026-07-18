import { render } from "@testing-library/react-native";

import { GameBoard } from "../../src/components/GameBoard";
import type { GridCell } from "../../src/domain/gameTypes";
import type { TimerBadgePlacement } from "../../src/domain/selectors";

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

  it("labels the board for screen readers", async () => {
    const result = await render(<GameBoard grid={makeEmptyGrid(8)} badges={[]} boardSize={328} />);
    expect(result.getByLabelText(/game board/i)).toBeTruthy();
  });
});
