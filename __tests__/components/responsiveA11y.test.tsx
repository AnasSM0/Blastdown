import { render } from "@testing-library/react-native";
import { StyleSheet, type ViewStyle } from "react-native";

import { ComboIndicator } from "../../src/components/ComboIndicator";
import { DragGhost } from "../../src/components/DragGhost";
import { GameBoard } from "../../src/components/GameBoard";
import { GridCell } from "../../src/components/GridCell";
import { PieceTray } from "../../src/components/PieceTray";
import { RewardedActionBar } from "../../src/components/RewardedActionButton";
import { ScoreHeader } from "../../src/components/ScoreHeader";
import { TimerBadge } from "../../src/components/TimerBadge";
import type { GridCell as DomainGridCell, HandPiece } from "../../src/domain/gameTypes";

function flat(node: { props: Record<string, unknown> }): ViewStyle {
  return (StyleSheet.flatten(node.props.style as ViewStyle) ?? {}) as ViewStyle;
}

function emptyGrid(): DomainGridCell[][] {
  return Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, (): DomainGridCell => ({ kind: "empty" })),
  );
}

// The Android black-render trap needs a rounded view carrying a transform on a
// hardware layer. Under reduced motion these views' animations never run, so the
// transform must be omitted entirely (an identity transform still promotes the
// layer). See docs/DECISIONS.md "turns black".
describe("reduced-motion Android transform guards (P1-10)", () => {
  it("TimerBadge omits the scale transform when reduced motion is on", async () => {
    const on = await render(
      <TimerBadge pieceId="a" remainingTurns={2} colorId="cyan" reducedMotion />,
    );
    expect(flat(on.getByTestId("timer-badge-a")).transform).toBeUndefined();

    const off = await render(
      <TimerBadge pieceId="b" remainingTurns={2} colorId="cyan" reducedMotion={false} />,
    );
    expect(flat(off.getByTestId("timer-badge-b")).transform).toBeDefined();
  });

  it("the board omits the shake transform when reduced motion is on", async () => {
    const on = await render(
      <GameBoard grid={emptyGrid()} badges={[]} boardSize={320} reducedMotion />,
    );
    expect(flat(on.getByTestId("game-board")).transform).toBeUndefined();

    const off = await render(
      <GameBoard grid={emptyGrid()} badges={[]} boardSize={320} reducedMotion={false} />,
    );
    expect(flat(off.getByTestId("game-board")).transform).toBeDefined();
  });

  it("DragGhost omits the scale transform when reduced motion is on", async () => {
    const ghost = await render(
      <DragGhost
        shapeId="single"
        colorId="cyan"
        cellSize={30}
        initialX={100}
        initialY={100}
        valid
        reducedMotion
      />,
    );
    expect(flat(ghost.getByTestId("drag-ghost")).transform).toBeUndefined();
  });

  it("PieceTray honors the effective reduced-motion prop (no lift transform)", async () => {
    const hand: HandPiece[] = [{ handId: "hand-0-0", shapeId: "single", colorId: "cyan" }];
    const tray = await render(
      <PieceTray hand={hand} selectedHandId="hand-0-0" onSelect={jest.fn()} reducedMotion />,
    );
    expect(flat(tray.getByTestId("tray-piece-hand-0-0")).transform).toBeUndefined();
  });
});

describe("timer numeral text scaling (P1-10)", () => {
  it("locks the timer numeral font so it never grows past the badge", async () => {
    const badge = await render(<TimerBadge pieceId="a" remainingTurns={3} colorId="cyan" />);
    expect(badge.getByText("3").props.allowFontScaling).toBe(false);
  });
});

describe("accessibility labels and hints (P1-10)", () => {
  it("announces rubble as a blocked cell", async () => {
    const result = await render(
      <GridCell cell={{ kind: "rubble", explosionId: "e1" }} row={0} column={0} size={40} />,
    );
    expect(result.getByTestId("cell-0-0").props.accessibilityLabel).toMatch(/blocked rubble/i);
  });

  it("gives an empty actionable cell a conditional placement hint", async () => {
    const actionable = await render(
      <GridCell cell={{ kind: "empty" }} row={1} column={1} size={40} onPress={jest.fn()} />,
    );
    // Conditional phrasing: tapping only places WHEN a piece is selected, so the
    // hint must not claim an unconditional placement. It is also phrased as an
    // ATTEMPT ("try to place") — even an empty cell can be an invalid anchor, so
    // the hint must not promise the placement will succeed.
    const hint = actionable.getByTestId("cell-1-1").props.accessibilityHint;
    expect(hint).toMatch(/if a piece is selected/i);
    expect(hint).toMatch(/try to place/i);

    const inert = await render(<GridCell cell={{ kind: "empty" }} row={2} column={2} size={40} />);
    expect(inert.getByTestId("cell-2-2").props.accessibilityHint).toBeUndefined();
  });

  it("does not give an occupied cell a placement hint (it is not a target)", async () => {
    const occupied = await render(
      <GridCell
        cell={{ kind: "normal", colorId: "cyan" }}
        row={3}
        column={3}
        size={40}
        onPress={jest.fn()}
      />,
    );
    expect(occupied.getByTestId("cell-3-3").props.accessibilityHint).toBeUndefined();
  });

  it("gives the pause control a hint describing what it does", async () => {
    const header = await render(<ScoreHeader score={0} best={0} combo={0} onPause={jest.fn()} />);
    expect(header.getByTestId("pause-button").props.accessibilityHint).toMatch(/pause/i);
  });

  it("caps combo text scaling so it can't grow the HUD unbounded", async () => {
    const combo = await render(<ComboIndicator combo={5} />);
    const text = combo.getByText("x5");
    expect(text.props.numberOfLines).toBe(1);
    expect(text.props.maxFontSizeMultiplier).toBeLessThanOrEqual(1.4);
  });
});

describe("dock accessibility state hints and scaling (P1-10)", () => {
  function bar(overrides: Partial<Parameters<typeof RewardedActionBar>[0]["freeze"]> = {}) {
    return render(
      <RewardedActionBar
        freeze={{
          label: "FREEZE",
          glyph: "❄",
          testID: "freeze-button",
          onPress: jest.fn(),
          disabled: false,
          active: false,
          placementsRemaining: 0,
          ...overrides,
        }}
        defuse={{
          label: "DEFUSE",
          glyph: "⚡",
          testID: "defuse-button",
          onPress: jest.fn(),
          disabled: false,
          selected: false,
        }}
      />,
    );
  }

  it("tells assistive tech that an available rewarded action watches an ad", async () => {
    const result = await bar({ rewarded: true });
    expect(result.getByTestId("freeze-button").props.accessibilityHint).toMatch(/ad/i);
  });

  it("announces the loading state while pending", async () => {
    const result = await bar({ phase: "pending" });
    expect(result.getByTestId("freeze-button").props.accessibilityHint).toMatch(/loading/i);
  });

  it("caps the dock label font so labels can't push controls off-screen", async () => {
    const result = await bar();
    const label = result.getByText("FREEZE");
    expect(label.props.numberOfLines).toBe(1);
    expect(label.props.maxFontSizeMultiplier).toBeLessThanOrEqual(1.3);
  });
});
