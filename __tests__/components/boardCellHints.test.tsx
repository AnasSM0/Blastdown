import { render } from "@testing-library/react-native";

import { GridCell } from "../../src/components/GridCell";
import { GameBoard } from "../../src/components/GameBoard";
import { getPlacementPreview } from "../../src/domain/selectors";
import type { GridCell as DomainGridCell } from "../../src/domain/gameTypes";

function emptyGrid(): DomainGridCell[][] {
  return Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, (): DomainGridCell => ({ kind: "empty" })),
  );
}

describe("GridCell accessibility hints (P1-10)", () => {
  it("announces valid placement on an interactive empty cell", async () => {
    const result = await render(
      <GridCell
        cell={{ kind: "empty" }}
        row={0}
        column={0}
        size={40}
        onPress={() => {}}
        placementState="valid"
      />,
    );
    expect(result.getByTestId("cell-0-0").props.accessibilityHint).toBe(
      "Double tap to place the selected piece here",
    );
  });

  it("announces invalid placement on an interactive empty cell", async () => {
    const result = await render(
      <GridCell
        cell={{ kind: "empty" }}
        row={0}
        column={0}
        size={40}
        onPress={() => {}}
        placementState="invalid"
      />,
    );
    expect(result.getByTestId("cell-0-0").props.accessibilityHint).toBe(
      "The selected piece can't be placed here",
    );
  });

  it("omits the hint when no piece is selected", async () => {
    const result = await render(
      <GridCell cell={{ kind: "empty" }} row={0} column={0} size={40} onPress={() => {}} />,
    );
    expect(result.getByTestId("cell-0-0").props.accessibilityHint).toBeUndefined();
  });

  it("omits the hint when an empty cell is not interactive", async () => {
    const result = await render(
      <GridCell cell={{ kind: "empty" }} row={0} column={0} size={40} placementState="valid" />,
    );
    expect(result.getByTestId("cell-0-0").props.accessibilityHint).toBeUndefined();
  });

  it("never presents occupied or rubble cells as placement targets", async () => {
    const cells: DomainGridCell[] = [
      { kind: "normal", colorId: "amber" },
      { kind: "timed", colorId: "cyan", pieceInstanceId: "timed-1" },
      { kind: "rubble", explosionId: "explosion-1" },
    ];
    for (const cell of cells) {
      const result = await render(
        <GridCell
          cell={cell}
          row={0}
          column={0}
          size={40}
          onPress={() => {}}
          placementState="valid"
        />,
      );
      expect(result.getByTestId("cell-0-0").props.accessibilityHint).toBeUndefined();
    }
  });
});

describe("GridCell accessibility labels (P1-10)", () => {
  it("identifies an empty cell with one-indexed coordinates", async () => {
    const result = await render(<GridCell cell={{ kind: "empty" }} row={0} column={0} size={40} />);
    expect(result.getByTestId("cell-0-0").props.accessibilityLabel).toMatch(
      /empty cell, row 1, column 1/i,
    );
  });

  it("identifies a normal block by color and coordinates", async () => {
    const result = await render(
      <GridCell cell={{ kind: "normal", colorId: "amber" }} row={2} column={2} size={40} />,
    );
    expect(result.getByTestId("cell-2-2").props.accessibilityLabel).toMatch(
      /amber block, row 3, column 3/i,
    );
  });

  it("identifies rubble as a blocked rubble cell", async () => {
    const result = await render(
      <GridCell
        cell={{ kind: "rubble", explosionId: "explosion-1" }}
        row={1}
        column={3}
        size={40}
      />,
    );
    expect(result.getByTestId("cell-1-3").props.accessibilityLabel).toMatch(/blocked rubble cell/i);
  });

  it("announces a singular timed move count and urgency", async () => {
    const result = await render(
      <GridCell
        cell={{ kind: "timed", colorId: "cyan", pieceInstanceId: "timed-1" }}
        row={0}
        column={0}
        size={40}
        remainingTurns={1}
        critical
      />,
    );
    const label = result.getByTestId("cell-0-0").props.accessibilityLabel;
    expect(label).toMatch(/cyan block with timer/i);
    expect(label).toMatch(/1 move left/i);
    expect(label).toMatch(/urgent/i);
  });

  it("announces plural frozen moves without urgency", async () => {
    const result = await render(
      <GridCell
        cell={{ kind: "timed", colorId: "purple", pieceInstanceId: "timed-2" }}
        row={0}
        column={0}
        size={40}
        remainingTurns={3}
        critical
        frozen
      />,
    );
    const label = result.getByTestId("cell-0-0").props.accessibilityLabel;
    expect(label).toMatch(/purple block with timer/i);
    expect(label).toMatch(/3 moves left/i);
    expect(label).toMatch(/frozen/i);
    expect(label).not.toMatch(/urgent/i);
  });
});

describe("GameBoard placement hint integration (P1-10)", () => {
  const onCellPress = () => {};

  it("drives valid and invalid cell hints from the placement map", async () => {
    const hints = new Map<string, "valid" | "invalid">([
      ["0,0", "valid"],
      ["0,1", "invalid"],
    ]);
    const result = await render(
      <GameBoard
        grid={emptyGrid()}
        badges={[]}
        boardSize={328}
        placementHints={hints}
        onCellPress={onCellPress}
      />,
    );
    expect(result.getByTestId("cell-0-0").props.accessibilityHint).toMatch(/place the selected/i);
    expect(result.getByTestId("cell-0-1").props.accessibilityHint).toMatch(
      /can't be placed|cannot be placed/i,
    );
  });

  it("omits cell hints when there is no placement map", async () => {
    const result = await render(
      <GameBoard
        grid={emptyGrid()}
        badges={[]}
        boardSize={328}
        placementHints={null}
        onCellPress={onCellPress}
      />,
    );
    expect(result.getByTestId("cell-0-0").props.accessibilityHint).toBeUndefined();
  });

  it("updates a cell hint when the selection changes", async () => {
    const grid = emptyGrid();
    const result = await render(
      <GameBoard
        grid={grid}
        badges={[]}
        boardSize={328}
        placementHints={null}
        onCellPress={onCellPress}
      />,
    );
    expect(result.getByTestId("cell-0-0").props.accessibilityHint).toBeUndefined();

    const hints = new Map<string, "valid" | "invalid">([["0,0", "valid"]]);
    await result.rerender(
      <GameBoard
        grid={grid}
        badges={[]}
        boardSize={328}
        placementHints={hints}
        onCellPress={onCellPress}
      />,
    );
    expect(result.getByTestId("cell-0-0").props.accessibilityHint).toMatch(/place the selected/i);
  });

  it("renders exactly 64 addressable board cells", async () => {
    const result = await render(<GameBoard grid={emptyGrid()} badges={[]} boardSize={328} />);
    expect(result.getAllByTestId(/^cell-\d+-\d+$/)).toHaveLength(64);
  });
});

describe("placement preview selector read-only behavior (P1-10)", () => {
  it("returns a stable plain preview without mutating the grid", () => {
    const grid = emptyGrid();
    const gridReference = grid;
    const cellReferences = grid.flat();
    const before = grid.map((row) => row.map((cell) => ({ ...cell })));
    const state = { grid } as Parameters<typeof getPlacementPreview>[0];

    const first = getPlacementPreview(state, "single", { row: 0, column: 0 });
    const second = getPlacementPreview(state, "single", { row: 0, column: 0 });

    expect(first).toEqual({
      valid: true,
      cells: [{ row: 0, column: 0 }],
      conflictCells: [],
      clear: { rows: [], columns: [], cells: [], intersections: [] },
    });
    expect(Object.getPrototypeOf(first)).toBe(Object.prototype);
    expect(typeof first.valid).toBe("boolean");
    expect(second.valid).toBe(first.valid);
    expect(grid).toBe(gridReference);
    grid.flat().forEach((cell, index) => expect(cell).toBe(cellReferences[index]));
    expect(grid).toEqual(before);
  });
});
