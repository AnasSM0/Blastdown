import { render } from "@testing-library/react-native";

import { CinematicBoard } from "../../src/components/CinematicBoard";
import { GameBoard } from "../../src/components/GameBoard";
import { createInitialGameState } from "../../src/domain/game";
import { getTimerBadgePlacements } from "../../src/domain/selectors";
import { resolveDangerState } from "../../src/ui/dangerState";

describe("danger renderer parity", () => {
  it("feeds both renderers the same semantic contract", async () => {
    const base = createInitialGameState("danger-parity", 0);
    const state = {
      ...base,
      activeTimers: {
        danger: {
          id: "danger",
          shapeId: "single",
          remainingTurns: 2,
          placedOnTurn: 0,
          colorId: "cyan",
        },
      },
    };
    const danger = resolveDangerState(state);
    const props = {
      grid: state.grid,
      badges: getTimerBadgePlacements(state),
      boardSize: 328,
      reducedMotion: true,
      danger,
    };
    const fallback = await render(<GameBoard {...props} />);
    const cinematic = await render(<CinematicBoard {...props} />);
    const fallbackLighting = fallback.getByTestId("board-danger-warning", {
      includeHiddenElements: true,
    });
    const cinematicLighting = cinematic.getByTestId("board-danger-warning", {
      includeHiddenElements: true,
    });
    expect(fallbackLighting.props.pointerEvents).toBe("none");
    expect(cinematicLighting.props.pointerEvents).toBe("none");
    expect(fallbackLighting.props.style).toEqual(cinematicLighting.props.style);
    await fallback.unmount();
    await cinematic.unmount();
  });
});
