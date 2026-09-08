import { fireEvent, render } from "@testing-library/react-native";

import { GameBoard } from "../../src/components/GameBoard";
import type { GridCell } from "../../src/domain/gameTypes";
import type { PlacementPreview } from "../../src/domain/selectors";

function makeEmptyGrid(size: number): GridCell[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, (): GridCell => ({ kind: "empty" })),
  );
}

describe("GameBoard preview and press", () => {
  it("marks valid preview cells", async () => {
    const preview: PlacementPreview = {
      valid: true,
      cells: [
        { row: 2, column: 1 },
        { row: 2, column: 2 },
      ],
      conflictCells: [],
      clear: { rows: [], columns: [], cells: [], intersections: [] },
    };
    const result = await render(
      <GameBoard grid={makeEmptyGrid(8)} badges={[]} boardSize={328} preview={preview} />,
    );
    expect(result.getAllByTestId(/^preview-valid-/)).toHaveLength(2);
    expect(result.queryAllByTestId(/^preview-conflict-/)).toHaveLength(0);
  });

  it("marks conflict cells distinctly within an invalid preview", async () => {
    const grid = makeEmptyGrid(8);
    grid[2][2] = { kind: "normal", colorId: "cyan" };
    const preview: PlacementPreview = {
      valid: false,
      cells: [
        { row: 2, column: 1 },
        { row: 2, column: 2 },
      ],
      conflictCells: [{ row: 2, column: 2 }],
      clear: { rows: [], columns: [], cells: [], intersections: [] },
    };
    const result = await render(
      <GameBoard grid={grid} badges={[]} boardSize={328} preview={preview} />,
    );
    expect(result.getAllByTestId(/^preview-invalid-/)).toHaveLength(1);
    expect(result.getAllByTestId(/^preview-conflict-/)).toHaveLength(1);
  });

  it("fires onCellPress with the pressed cell position", async () => {
    const onCellPress = jest.fn();
    const result = await render(
      <GameBoard grid={makeEmptyGrid(8)} badges={[]} boardSize={328} onCellPress={onCellPress} />,
    );
    await fireEvent.press(result.getByTestId("cell-3-4"));
    expect(onCellPress).toHaveBeenCalledWith({ row: 3, column: 4 });
  });
});
