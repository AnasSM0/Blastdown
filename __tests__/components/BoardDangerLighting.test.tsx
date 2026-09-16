import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import {
  BoardDangerLighting,
  dangerLightingVisual,
} from "../../src/components/BoardDangerLighting";
import { resolveDangerState } from "../../src/ui/dangerState";
import { resolveTheme } from "../../src/ui/themes";
import { createInitialGameState } from "../../src/domain/game";

const theme = resolveTheme(undefined);

function danger(remainingTurns: number) {
  const state = createInitialGameState("light", 0);
  return resolveDangerState({
    ...state,
    activeTimers: {
      timed: {
        id: "timed",
        shapeId: "single",
        remainingTurns,
        placedOnTurn: 0,
        colorId: "cyan",
      },
    },
  });
}

describe("BoardDangerLighting", () => {
  it("keeps a static, non-color urgency hierarchy under Reduced Motion", async () => {
    const warning = dangerLightingVisual(danger(2), theme);
    const critical = dangerLightingVisual(danger(1), theme);
    expect(critical.borderWidth).toBeGreaterThan(warning.borderWidth);
    expect(critical.opacity).toBeGreaterThan(warning.opacity);

    const result = await render(
      <BoardDangerLighting danger={danger(1)} reducedMotion testID="danger" />,
    );
    const lighting = result.getByTestId("danger", { includeHiddenElements: true });
    const style = StyleSheet.flatten(lighting.props.style);
    expect(style.opacity).toBe(critical.opacity);
    expect(style.transform).toBeUndefined();
    expect(lighting.props.pointerEvents).toBe("none");
  });
});
