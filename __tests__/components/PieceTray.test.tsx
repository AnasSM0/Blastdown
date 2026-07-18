import { fireEvent, render } from "@testing-library/react-native";

import { PieceTray } from "../../src/components/PieceTray";
import type { HandPiece } from "../../src/domain/gameTypes";

const hand: HandPiece[] = [
  { handId: "h1", shapeId: "single", colorId: "cyan" },
  { handId: "h2", shapeId: "line3h", colorId: "purple" },
  { handId: "h3", shapeId: "square2x2", colorId: "amber" },
];

describe("PieceTray", () => {
  it("renders exactly three pieces when the hand is full", async () => {
    const result = await render(
      <PieceTray hand={hand} selectedHandId={null} onSelect={jest.fn()} />,
    );
    expect(result.getAllByTestId(/^tray-piece-/)).toHaveLength(3);
  });

  it("renders fewer slots as the hand empties", async () => {
    const result = await render(
      <PieceTray hand={hand.slice(0, 1)} selectedHandId={null} onSelect={jest.fn()} />,
    );
    expect(result.getAllByTestId(/^tray-piece-/)).toHaveLength(1);
  });

  it("fires onSelect with the piece's handId when tapped", async () => {
    const onSelect = jest.fn();
    const result = await render(
      <PieceTray hand={hand} selectedHandId={null} onSelect={onSelect} />,
    );
    fireEvent.press(result.getByTestId("tray-piece-h2"));
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
});
