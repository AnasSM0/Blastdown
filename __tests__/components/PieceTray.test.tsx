import { fireEvent, render, within } from "@testing-library/react-native";
import { StyleSheet, type ViewStyle } from "react-native";

import { PieceTray } from "../../src/components/PieceTray";
import type { HandPiece } from "../../src/domain/gameTypes";

const hand: HandPiece[] = [
  { handId: "h1", shapeId: "single", colorId: "cyan" },
  { handId: "h2", shapeId: "line3h", colorId: "purple" },
  { handId: "h3", shapeId: "square2x2", colorId: "amber" },
];

// Domain-format handIds (`hand-<refill>-<slot>`); the trailing index is the
// authoritative slot the tray must keep the piece in as the hand shrinks.
const slotHand: HandPiece[] = [
  { handId: "hand-0-0", shapeId: "single", colorId: "cyan" },
  { handId: "hand-0-1", shapeId: "line3h", colorId: "purple" },
  { handId: "hand-0-2", shapeId: "square2x2", colorId: "amber" },
];

function styleOf(node: { props: Record<string, unknown> }): ViewStyle {
  return (StyleSheet.flatten(node.props.style as ViewStyle) ?? {}) as ViewStyle;
}

describe("PieceTray", () => {
  it("renders exactly three pieces when the hand is full", async () => {
    const result = await render(
      <PieceTray hand={hand} selectedHandId={null} onSelect={jest.fn()} />,
    );
    expect(result.getAllByTestId(/^tray-piece-/)).toHaveLength(3);
  });

  it("always renders exactly three fixed slots, full or partial (P1-7)", async () => {
    const full = await render(
      <PieceTray hand={slotHand} selectedHandId={null} onSelect={jest.fn()} />,
    );
    expect(full.getAllByTestId(/^tray-slot-\d+$/)).toHaveLength(3);

    const partial = await render(
      <PieceTray hand={[slotHand[0]]} selectedHandId={null} onSelect={jest.fn()} />,
    );
    // Still three slots; one piece, two dim placeholders.
    expect(partial.getAllByTestId(/^tray-slot-\d+$/)).toHaveLength(3);
    expect(partial.getAllByTestId(/^tray-piece-/)).toHaveLength(1);
    expect(partial.getAllByTestId("tray-slot-empty")).toHaveLength(2);
  });

  it.each([
    [0, "hand-0-1", "hand-0-2"],
    [1, "hand-0-0", "hand-0-2"],
    [2, "hand-0-0", "hand-0-1"],
  ])(
    "leaves a placeholder in consumed slot %i without reflowing the others (P1-7)",
    async (consumedIndex, keepA, keepB) => {
      const remaining = slotHand.filter((piece) => piece.handId !== `hand-0-${consumedIndex}`);
      const result = await render(
        <PieceTray hand={remaining} selectedHandId={null} onSelect={jest.fn()} />,
      );

      // The consumed slot holds the empty placeholder, in place…
      const consumedSlot = result.getByTestId(`tray-slot-${consumedIndex}`);
      expect(within(consumedSlot).getByTestId("tray-slot-empty")).toBeTruthy();
      expect(within(consumedSlot).queryByTestId(/^tray-piece-/)).toBeNull();

      // …and the two survivors stay in their original slots (no compaction).
      expect(result.getByTestId(`tray-piece-${keepA}`)).toBeTruthy();
      expect(result.getByTestId(`tray-piece-${keepB}`)).toBeTruthy();
      expect(result.getAllByTestId("tray-slot-empty")).toHaveLength(1);
    },
  );

  it("makes a consumed placeholder non-interactive (no button, not selectable) (P1-7)", async () => {
    const result = await render(
      <PieceTray hand={[slotHand[0], slotHand[2]]} selectedHandId={null} onSelect={jest.fn()} />,
    );
    const empty = within(result.getByTestId("tray-slot-1")).getByTestId("tray-slot-empty");
    // No button role and no piece testID → cannot be selected or dragged.
    expect(empty.props.accessibilityRole).toBeUndefined();
    expect(within(result.getByTestId("tray-slot-1")).queryByTestId(/^tray-piece-/)).toBeNull();
  });

  it("restores three active pieces on refill (P1-7)", async () => {
    const refilled: HandPiece[] = [
      { handId: "hand-1-0", shapeId: "single", colorId: "amber" },
      { handId: "hand-1-1", shapeId: "line3h", colorId: "cyan" },
      { handId: "hand-1-2", shapeId: "square2x2", colorId: "purple" },
    ];
    const result = await render(
      <PieceTray hand={refilled} selectedHandId={null} onSelect={jest.fn()} />,
    );
    expect(result.getAllByTestId(/^tray-piece-/)).toHaveLength(3);
    expect(result.queryAllByTestId("tray-slot-empty")).toHaveLength(0);
  });

  it("keeps the selected piece selected when another slot is consumed (P1-7)", async () => {
    // Slot 1 consumed; slot 2 (hand-0-2) stays selected — selection is by
    // authoritative handId, independent of slot rendering.
    const result = await render(
      <PieceTray
        hand={[slotHand[0], slotHand[2]]}
        selectedHandId="hand-0-2"
        onSelect={jest.fn()}
      />,
    );
    expect(result.getByTestId("tray-piece-hand-0-2").props.accessibilityState?.selected).toBe(true);
    expect(result.getByTestId("tray-piece-hand-0-0").props.accessibilityState?.selected).toBe(
      false,
    );
  });

  it("does not clip slots with overflow:hidden (Android black-box guard) (P1-7)", async () => {
    const result = await render(
      <PieceTray hand={[slotHand[0]]} selectedHandId={null} onSelect={jest.fn()} />,
    );
    // A rounded, clipped slot on a hardware layer renders black on Android.
    expect(styleOf(result.getByTestId("tray-piece-hand-0-0")).overflow).not.toBe("hidden");
    expect(styleOf(result.getAllByTestId("tray-slot-empty")[0]).overflow).not.toBe("hidden");
  });

  it("fires onSelect with the piece's handId when tapped", async () => {
    const onSelect = jest.fn();
    const result = await render(
      <PieceTray hand={hand} selectedHandId={null} onSelect={onSelect} />,
    );
    await fireEvent.press(result.getByTestId("tray-piece-h2"));
    expect(onSelect).toHaveBeenCalledWith("h2");
  });

  it("marks the selected piece for accessibility", async () => {
    const result = await render(<PieceTray hand={hand} selectedHandId="h1" onSelect={jest.fn()} />);
    const selected = result.getByTestId("tray-piece-h1");
    expect(selected.props.accessibilityState?.selected).toBe(true);
  });

  it("describes each piece's shape and color in its label", async () => {
    const result = await render(
      <PieceTray hand={hand} selectedHandId={null} onSelect={jest.fn()} />,
    );
    expect(result.getByLabelText(/purple.*line3h/i)).toBeTruthy();
  });

  it("keeps tap-to-select working when drag handlers are wired", async () => {
    const onSelect = jest.fn();
    const result = await render(
      <PieceTray
        hand={hand}
        selectedHandId={null}
        onSelect={onSelect}
        onDragStart={jest.fn()}
        onDragMove={jest.fn()}
        onDragEnd={jest.fn()}
        draggingHandId={null}
      />,
    );
    // Tap fallback (accessibility path) must survive alongside the gesture.
    await fireEvent.press(result.getByTestId("tray-piece-h2"));
    expect(onSelect).toHaveBeenCalledWith("h2");
    expect(result.getAllByTestId(/^tray-piece-/)).toHaveLength(3);
  });

  it("dims the slot of the piece currently being dragged", async () => {
    const result = await render(
      <PieceTray
        hand={hand}
        selectedHandId={null}
        onSelect={jest.fn()}
        onDragStart={jest.fn()}
        onDragMove={jest.fn()}
        onDragEnd={jest.fn()}
        draggingHandId="h1"
      />,
    );
    expect(styleOf(result.getByTestId("tray-piece-h1")).opacity).toBe(0.4);
  });
});
