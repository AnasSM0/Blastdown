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

function styleOf(node: { props: Record<string, unknown> }): ViewStyle {
  return (StyleSheet.flatten(node.props.style as ViewStyle) ?? {}) as ViewStyle;
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
    const rubbleResult = await render(
      <GridCell cell={{ kind: "rubble", explosionId: "e1" }} row={0} column={0} size={40} />,
    );
    const rubble = fillOf(rubbleResult.getByTestId("rubble-0-0"));
    const filledResult = await render(
      <GridCell cell={{ kind: "normal", colorId: "cyan" }} row={0} column={0} size={40} />,
    );
    const filled = fillOf(filledResult.getByTestId("block-0-0"));
    // Rubble uses its own graphite base, distinct from the empty cell and blocks.
    expect(rubble).toBe(reactor.rubbleFill);
    expect(empty).not.toBe(filled);
    expect(empty).not.toBe(rubble);
    expect(filled).not.toBe(rubble);
  });

  it("renders the cracked rubble surface (no placeholder X) as a non-interactive tile", async () => {
    const result = await render(
      <GridCell cell={{ kind: "rubble", explosionId: "e1" }} row={2} column={3} size={40} />,
    );
    const tile = result.getByTestId("rubble-2-3");
    expect(tile).toBeTruthy();
    // The rubble surface never intercepts touches; the pressable behind it does.
    expect(tile.props.pointerEvents).toBe("none");
    // It is not a block tile and keeps its blocked/rubble label.
    expect(result.queryByTestId("block-2-3")).toBeNull();
    expect(result.getByLabelText(/rubble.*row 3.*column 4/i)).toBeTruthy();
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
    // …matching the shared material's normal/critical bodies (same cyan family,
    // color preserved — the edge, not the body, carries the raw accent).
    expect(normalFill).toBe(blockSurface(reactor, accent, "normal").fill);
    expect(criticalFill).toBe(blockSurface(reactor, accent, "critical").fill);
  });

  it("renders every placed color with a solid body distinct from the empty cell (regression)", async () => {
    // Guards the placed-block visibility regression: a normal placed block must
    // use the visible normal material, never a translucent/disabled/preview fill.
    for (const colorId of ["cyan", "purple", "amber"] as const) {
      const result = await render(
        <GridCell cell={{ kind: "normal", colorId }} row={0} column={0} size={40} />,
      );
      const fill = fillOf(result.getByTestId("block-0-0"));
      expect(fill).toBe(blockSurface(reactor, blockColor(reactor, colorId), "normal").fill);
      // Opaque body (7-char hex, no alpha) that is not the empty-cell surface.
      expect(String(fill)).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(fill).not.toBe(reactor.emptyCell);
    }
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

  it("renders the placed block body with no Android elevation/shadow (device regression)", async () => {
    // An elevated child inside the cell's animated transform parent fails to
    // render on Android; the body must stay a plain opaque layer.
    const result = await render(
      <GridCell cell={{ kind: "normal", colorId: "cyan" }} row={0} column={0} size={40} />,
    );
    const tile = styleOf(result.getByTestId("block-0-0"));
    expect(tile.elevation).toBeUndefined();
    expect(tile.shadowColor).toBeUndefined();
    expect(tile.shadowRadius).toBeUndefined();
    // Body is fully opaque and uses the normal (not disabled/preview) material.
    expect(tile.opacity).toBe(1);
    expect(tile.backgroundColor).toBe(
      blockSurface(reactor, blockColor(reactor, "cyan"), "normal").fill,
    );
  });

  it("does not paint empty-cell chrome on an occupied cell (device regression)", async () => {
    // The occupied cell's pressable stays transparent so nothing renders above
    // the block body; the empty-cell fill must never appear on a placed cell.
    const result = await render(
      <GridCell cell={{ kind: "normal", colorId: "cyan" }} row={0} column={0} size={40} />,
    );
    const cell = styleOf(result.getByTestId("cell-0-0"));
    expect(cell.backgroundColor).toBeUndefined();
    expect(cell.backgroundColor).not.toBe(reactor.emptyCell);
  });

  it("keeps a timed piece's contour border-only with a transparent interior", async () => {
    const result = await render(
      <GridCell
        cell={{ kind: "timed", colorId: "cyan", pieceInstanceId: "p1" }}
        row={0}
        column={0}
        size={40}
        contourEdges={{ top: true, right: true, bottom: true, left: true }}
      />,
    );
    const contour = styleOf(result.getByTestId("contour-0-0"));
    // No fill — the block body shows through the contour's interior.
    expect(contour.backgroundColor).toBeUndefined();
  });

  it("keeps the placed block fully visible under reduced motion (device regression)", async () => {
    // Reduced motion must affect animation only, never static visibility.
    const result = await render(
      <GridCell
        cell={{ kind: "normal", colorId: "amber" }}
        row={0}
        column={0}
        size={40}
        reducedMotion
      />,
    );
    const tile = styleOf(result.getByTestId("block-0-0"));
    expect(tile.opacity).toBe(1);
    expect(tile.backgroundColor).toBe(
      blockSurface(reactor, blockColor(reactor, "amber"), "normal").fill,
    );
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
