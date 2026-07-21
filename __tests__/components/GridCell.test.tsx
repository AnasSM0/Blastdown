import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { GridCell } from "../../src/components/GridCell";
import type { GridCell as DomainGridCell } from "../../src/domain/gameTypes";
import { resolveTheme } from "../../src/ui/themes";

const reactor = resolveTheme(undefined);

function fillOf(node: { props: { style: unknown } }): unknown {
  return StyleSheet.flatten(node.props.style as never).backgroundColor;
}

async function renderCell(cell: DomainGridCell, extra?: Record<string, unknown>) {
  const result = await render(
    <GridCell cell={cell} row={0} column={0} size={40} onPress={() => {}} {...extra} />,
  );
  return result.getByTestId("cell-0-0");
}

describe("GridCell empty presentation (P1-3)", () => {
  it("fills an empty cell with the dedicated empty-cell token, not the board panel", async () => {
    const node = await renderCell({ kind: "empty" });
    expect(fillOf(node)).toBe(reactor.emptyCell);
    expect(fillOf(node)).not.toBe(reactor.boardBg);
  });

  it("keeps empty, filled, and rubble cells visually distinct", async () => {
    const empty = fillOf(await renderCell({ kind: "empty" }));
    const filled = fillOf(await renderCell({ kind: "normal", colorId: "cyan" }));
    const rubble = fillOf(await renderCell({ kind: "rubble", explosionId: "e1" }));
    expect(empty).not.toBe(filled);
    expect(empty).not.toBe(rubble);
    expect(filled).not.toBe(rubble);
  });

  it("renders a preview overlay distinct from the empty cell underneath", async () => {
    const result = await render(
      <GridCell cell={{ kind: "empty" }} row={0} column={0} size={40} previewState="valid" />,
    );
    expect(result.getByTestId("preview-valid-0-0")).toBeTruthy();
    expect(fillOf(result.getByTestId("cell-0-0"))).toBe(reactor.emptyCell);
  });

  it("preserves the empty-cell accessibility label", async () => {
    const result = await render(<GridCell cell={{ kind: "empty" }} row={2} column={3} size={40} />);
    expect(result.getByLabelText(/empty cell.*row 3.*column 4/i)).toBeTruthy();
  });
});
