import { Animated, StyleSheet } from "react-native";
import { render } from "@testing-library/react-native";

import { GameBoard } from "../../src/components/GameBoard";
import type { GridCell } from "../../src/domain/gameTypes";
import type { PlacementPreview } from "../../src/domain/selectors";
import { sceneGeometry } from "../../src/rendering/cinematic/geometry";
import { buildPreClearHighlights } from "../../src/rendering/cinematic/scene";
import { resolveTheme } from "../../src/ui/themes";

function emptyGrid(): GridCell[][] {
  return Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, (): GridCell => ({ kind: "empty" })),
  );
}

function prediction(overrides: Partial<PlacementPreview> = {}): PlacementPreview {
  return {
    valid: true,
    cells: [{ row: 3, column: 4 }],
    conflictCells: [],
    clear: {
      rows: [3],
      columns: [4],
      cells: [
        ...Array.from({ length: 8 }, (_, column) => ({ row: 3, column })),
        ...Array.from({ length: 7 }, (_, row) => ({ row: row < 3 ? row : row + 1, column: 4 })),
      ],
      intersections: [{ row: 3, column: 4 }],
    },
    ...overrides,
  };
}

describe("pre-clear renderer contract", () => {
  it("draws the full predicted row and column in the fallback renderer", async () => {
    const view = await render(
      <GameBoard grid={emptyGrid()} badges={[]} boardSize={328} preview={prediction()} />,
    );

    expect(view.getByTestId("preclear-row-3")).toBeTruthy();
    expect(view.getByTestId("preclear-column-4")).toBeTruthy();
  });

  it("draws no line highlight for invalid prediction data", async () => {
    const view = await render(
      <GameBoard
        grid={emptyGrid()}
        badges={[]}
        boardSize={328}
        preview={prediction({ valid: false })}
      />,
    );

    expect(view.queryAllByTestId(/^preclear-/)).toHaveLength(0);
  });

  it("uses a stable, non-animated highlight under Reduced Motion", async () => {
    const view = await render(
      <GameBoard
        grid={emptyGrid()}
        badges={[]}
        boardSize={328}
        preview={prediction()}
        reducedMotion
      />,
    );

    const style = StyleSheet.flatten(view.getByTestId("preclear-row-3").props.style);
    expect(style.opacity).toBe(1);
    expect(style.opacity).not.toBeInstanceOf(Animated.Value);
  });

  it("builds cinematic rows and columns from the same prediction object", () => {
    const preview = prediction();
    const highlights = buildPreClearHighlights(
      preview,
      sceneGeometry(328, 8),
      resolveTheme(undefined),
    );

    expect(highlights.map(({ orientation, index }) => ({ orientation, index }))).toEqual([
      { orientation: "row", index: 3 },
      { orientation: "column", index: 4 },
    ]);
    expect(preview.clear.intersections).toEqual([{ row: 3, column: 4 }]);
    expect(highlights[0].visual).toEqual(highlights[1].visual);
  });

  it("returns one stable empty cinematic scene for absent or invalid prediction", () => {
    const geometry = sceneGeometry(328, 8);
    const theme = resolveTheme(undefined);
    const absent = buildPreClearHighlights(null, geometry, theme);
    const invalid = buildPreClearHighlights(prediction({ valid: false }), geometry, theme);

    expect(absent).toHaveLength(0);
    expect(invalid).toBe(absent);
  });
});
