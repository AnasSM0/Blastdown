import { act, fireEvent, render } from "@testing-library/react-native";

import { GameScreenContent } from "../../app/game";
import { createInitialGameState } from "../../src/domain/game";
import { createMockAdService } from "../../src/services/ads/MockAdService";
import type { AdService } from "../../src/services/ads/types";
import type { GameState, GridCell } from "../../src/domain/gameTypes";

const NOW = 1_752_800_000_000;

function emptyGrid(): GridCell[][] {
  return Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, (): GridCell => ({ kind: "empty" })),
  );
}

/** A live run with one active timed piece `t1` (cells at row 0, cols 0–1) and
 *  a spare hand — so both Freeze and Defuse are available. */
function runWithTimer(): GameState {
  const grid = emptyGrid();
  grid[0][0] = { kind: "timed", pieceInstanceId: "t1", colorId: "cyan" };
  grid[0][1] = { kind: "timed", pieceInstanceId: "t1", colorId: "cyan" };
  return {
    ...createInitialGameState("reward-seed", NOW),
    status: "playing",
    grid,
    activeTimers: {
      t1: { id: "t1", shapeId: "domino", remainingTurns: 2, placedOnTurn: 1, colorId: "cyan" },
    },
    hand: [{ handId: "h-spare", shapeId: "single", colorId: "amber" }],
  };
}

function renderRun(adService: AdService) {
  return render(
    <GameScreenContent
      controllerOptions={{ seed: "reward-seed", now: () => NOW, initialState: runWithTimer() }}
      boardSize={328}
      adService={adService}
    />,
  );
}

describe("freeze reward flow", () => {
  it("activates freeze on an earned reward and shows remaining placements", async () => {
    const service = createMockAdService({ rewarded: { rewarded_freeze: "earned" } });
    const result = await renderRun(service);

    await act(async () => {
      fireEvent.press(result.getByTestId("freeze-button"));
    });

    expect(result.getByTestId("freeze-moves-label").props.children).toEqual([2, " ", "MOVES"]);
    expect(service.shown).toEqual(["rewarded_freeze"]);
    // Cannot stack: the freeze button is now disabled while active.
    expect(result.getByTestId("freeze-button").props.accessibilityState?.disabled).toBe(true);
  });

  it.each(["closed", "error"] as const)(
    "leaves state unchanged when the reward is %s",
    async (outcome) => {
      const service = createMockAdService({ rewarded: { rewarded_freeze: outcome } });
      const result = await renderRun(service);

      await act(async () => {
        fireEvent.press(result.getByTestId("freeze-button"));
      });

      // No active freeze: the moves label never appears.
      expect(result.queryByTestId("freeze-moves-label")).toBeNull();
      expect(service.shown).toEqual(["rewarded_freeze"]);
    },
  );
});

describe("defuse reward flow", () => {
  it("confirms, targets the domain-selected piece, and defuses on earn", async () => {
    const service = createMockAdService({ rewarded: { rewarded_defuse: "earned" } });
    const result = await renderRun(service);

    await act(async () => {
      fireEvent.press(result.getByTestId("defuse-button"));
    });
    // Confirm card up and the target piece's cells are highlighted.
    expect(result.getByTestId("defuse-confirm")).toBeTruthy();
    expect(result.getByTestId("highlight-0-0")).toBeTruthy();
    expect(result.getByTestId("highlight-0-1")).toBeTruthy();

    await act(async () => {
      fireEvent.press(result.getByTestId("defuse-confirm-button"));
    });
    // Card dismissed, reward spent, and the timer badge is gone (piece defused).
    expect(result.queryByTestId("defuse-confirm")).toBeNull();
    expect(result.queryByTestId("highlight-0-0")).toBeNull();
    expect(service.shown).toEqual(["rewarded_defuse"]);
  });

  it("cancel closes the card and shows no ad, no mutation", async () => {
    const service = createMockAdService();
    const result = await renderRun(service);

    await act(async () => {
      fireEvent.press(result.getByTestId("defuse-button"));
    });
    await act(async () => {
      fireEvent.press(result.getByTestId("defuse-cancel-button"));
    });

    expect(result.queryByTestId("defuse-confirm")).toBeNull();
    expect(service.shown).toEqual([]);
  });

  it("does not mutate when the confirm reward fails", async () => {
    const service = createMockAdService({ rewarded: { rewarded_defuse: "error" } });
    const result = await renderRun(service);

    await act(async () => {
      fireEvent.press(result.getByTestId("defuse-button"));
    });
    await act(async () => {
      fireEvent.press(result.getByTestId("defuse-confirm-button"));
    });

    expect(result.queryByTestId("defuse-confirm")).toBeNull();
    // The piece survived: pressing defuse again re-targets the same cells.
    await act(async () => {
      fireEvent.press(result.getByTestId("defuse-button"));
    });
    expect(result.getByTestId("highlight-0-0")).toBeTruthy();
  });
});
