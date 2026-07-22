import { render } from "@testing-library/react-native";
import { StyleSheet, type ViewStyle } from "react-native";

import { GridCell } from "../../src/components/GridCell";
import type { GridCell as DomainGridCell } from "../../src/domain/gameTypes";
import { blockColor, resolveTheme } from "../../src/ui/themes";
import { blockSurface } from "../../src/ui/blockSurface";

const reactor = resolveTheme(undefined);

function fillOf(node: { props: Record<string, unknown> }): unknown {
  return StyleSheet.flatten(node.props.style as ViewStyle)?.backgroundColor;
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

describe("GridCell premium block surfaces (P1-4)", () => {
  it("renders the shared block material for every block color", async () => {
    for (const colorId of ["cyan", "purple", "amber"] as const) {
      const result = await render(
        <GridCell cell={{ kind: "normal", colorId }} row={0} column={0} size={40} />,
      );
      const tile = result.getByTestId("block-0-0");
      expect(fillOf(tile)).toBe(blockSurface(reactor, blockColor(reactor, colorId), "normal").fill);
    }
  });

  it("keeps empty, filled, and rubble surfaces visually distinct", async () => {
    const empty = fillOf(await renderCell({ kind: "empty" }));
    const rubble = fillOf(await renderCell({ kind: "rubble", explosionId: "e1" }));
    const filledResult = await render(
      <GridCell cell={{ kind: "normal", colorId: "cyan" }} row={0} column={0} size={40} />,
    );
    const filled = fillOf(filledResult.getByTestId("block-0-0"));
    expect(empty).not.toBe(filled);
    expect(empty).not.toBe(rubble);
    expect(filled).not.toBe(rubble);
  });

  it("intensifies a critical timed block without losing its color", async () => {
    const accent = blockColor(reactor, "cyan");
    const normalResult = await render(
      <GridCell
        cell={{ kind: "timed", colorId: "cyan", pieceInstanceId: "p1" }}
        row={0}
        column={0}
        size={40}
      />,
    );
    const criticalResult = await render(
      <GridCell
        cell={{ kind: "timed", colorId: "cyan", pieceInstanceId: "p1" }}
        row={0}
        column={0}
        size={40}
        critical
      />,
    );
    const normalFill = fillOf(normalResult.getByTestId("block-0-0"));
    const criticalFill = fillOf(criticalResult.getByTestId("block-0-0"));
    // Distinct material…
    expect(criticalFill).not.toBe(normalFill);
    // …but the same underlying color identity (both tints of the cyan accent).
    expect(String(normalFill).startsWith(accent)).toBe(true);
    expect(String(criticalFill).startsWith(accent)).toBe(true);
  });

  it("strokes the piece contour in the block accent on boundary sides only (P1-5)", async () => {
    const accent = blockColor(reactor, "cyan");
    const result = await render(
      <GridCell
        cell={{ kind: "timed", colorId: "cyan", pieceInstanceId: "p1" }}
        row={0}
        column={0}
        size={40}
        contourEdges={{ top: true, right: false, bottom: true, left: true }}
      />,
    );
    const contour = StyleSheet.flatten(
      result.getByTestId("contour-0-0").props.style as ViewStyle,
    ) as ViewStyle;
    // Contour carries the piece's own accent, preserving color identity.
    expect(contour.borderColor).toBe(accent);
    // Boundary sides are stroked; the internal (right) side is not.
    expect(contour.borderTopWidth).toBeGreaterThan(0);
    expect(contour.borderLeftWidth).toBeGreaterThan(0);
    expect(contour.borderBottomWidth).toBeGreaterThan(0);
    expect(contour.borderRightWidth).toBe(0);
    // The contour never intercepts touches.
    expect(result.getByTestId("contour-0-0").props.pointerEvents).toBe("none");
  });

  it("renders no contour when none is supplied", async () => {
    const result = await render(
      <GridCell cell={{ kind: "normal", colorId: "cyan" }} row={0} column={0} size={40} />,
    );
    expect(result.queryByTestId("contour-0-0")).toBeNull();
  });

  it("does not render a block tile for empty or rubble cells", async () => {
    const empty = await render(<GridCell cell={{ kind: "empty" }} row={0} column={0} size={40} />);
    expect(empty.queryByTestId("block-0-0")).toBeNull();
    const rubble = await render(
      <GridCell cell={{ kind: "rubble", explosionId: "e1" }} row={0} column={0} size={40} />,
    );
    expect(rubble.queryByTestId("block-0-0")).toBeNull();
  });
});
