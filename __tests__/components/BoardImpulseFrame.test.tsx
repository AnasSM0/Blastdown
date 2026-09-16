import { render } from "@testing-library/react-native";
import { Animated, StyleSheet, Text } from "react-native";

import { BoardImpulseFrame } from "../../src/components/BoardImpulseFrame";

describe("fallback board impulse", () => {
  it("moves the board group with one bounded driver for each new effect identity", async () => {
    const timing = jest.spyOn(Animated, "timing");
    const impulse = {
      id: "s1:t1",
      source: "clear" as const,
      amplitudePx: 4,
      durationMs: 250,
    };
    const result = await render(
      <BoardImpulseFrame impulse={impulse} reducedMotion={false}>
        <Text testID="board-content">board and overlay</Text>
      </BoardImpulseFrame>,
    );

    expect(result.getByTestId("board-content")).toBeTruthy();
    expect(timing).toHaveBeenCalledTimes(4);
    expect(timing.mock.calls.map((call) => call[1].toValue)).toEqual([-2.2, 4, -1.6, 0]);

    await result.rerender(
      <BoardImpulseFrame impulse={{ ...impulse }} reducedMotion={false}>
        <Text testID="board-content">board and overlay</Text>
      </BoardImpulseFrame>,
    );
    expect(timing).toHaveBeenCalledTimes(4);

    await result.rerender(
      <BoardImpulseFrame impulse={null} reducedMotion={false}>
        <Text testID="board-content">board and overlay</Text>
      </BoardImpulseFrame>,
    );
    await result.rerender(
      <BoardImpulseFrame impulse={impulse} reducedMotion={false}>
        <Text testID="board-content">board and overlay</Text>
      </BoardImpulseFrame>,
    );
    expect(timing).toHaveBeenCalledTimes(4);

    await result.rerender(
      <BoardImpulseFrame impulse={{ ...impulse, id: "s1:t2" }} reducedMotion={false}>
        <Text testID="board-content">board and overlay</Text>
      </BoardImpulseFrame>,
    );
    expect(timing).toHaveBeenCalledTimes(8);
    timing.mockRestore();
  });

  it("binds no transform and starts no motion under Reduced Motion", async () => {
    const timing = jest.spyOn(Animated, "timing");
    const result = await render(
      <BoardImpulseFrame
        impulse={{ id: "s1:t1", source: "clear", amplitudePx: 6, durationMs: 350 }}
        reducedMotion
      >
        <Text>board</Text>
      </BoardImpulseFrame>,
    );

    expect(timing).not.toHaveBeenCalled();
    const style = StyleSheet.flatten(result.getByTestId("board-impulse-frame").props.style);
    expect(style.transform).toBeUndefined();
    timing.mockRestore();
  });
});
