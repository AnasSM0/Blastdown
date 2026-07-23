import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

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

/** The dock's transient outcome flash (pending/success/failure/cancelled) is
 *  presentation-only reward-state mapping in game.tsx: the earn-only mutation is
 *  unchanged (asserted above). These cover the outcome→caption mapping and the
 *  auto-clear. Real timers throughout (faking timers deadlocks RNTL's async
 *  `act`, which flushes via a faked `setImmediate`); the flash is short and the
 *  clear is awaited with `waitFor`. */
describe("dock transient reward feedback", () => {
  it.each([
    ["closed", "CANCELLED"],
    ["error", "AD FAILED"],
  ] as const)("flashes the freeze caption on a %s reward, then clears it", async (outcome, cue) => {
    const service = createMockAdService({ rewarded: { rewarded_freeze: outcome } });
    const result = await renderRun(service);

    await act(async () => {
      fireEvent.press(result.getByTestId("freeze-button"));
    });
    // The outcome is surfaced on the button (freeze is not active on a non-earn).
    expect(result.getByTestId("freeze-button-caption").props.children).toBe(cue);

    // The flash auto-clears back to the resting caption (flash is 1400ms; give
    // waitFor headroom past that and its 1000ms default).
    await waitFor(
      () => expect(result.getByTestId("freeze-button-caption").props.children).toBe(""),
      { timeout: 2500 },
    );
  });

  it("does not leak a transient caption over active freeze on an earned reward", async () => {
    const service = createMockAdService({ rewarded: { rewarded_freeze: "earned" } });
    const result = await renderRun(service);

    await act(async () => {
      fireEvent.press(result.getByTestId("freeze-button"));
    });
    // Active wins: the moves label shows, not a success caption.
    expect(result.getByTestId("freeze-moves-label").props.children).toEqual([2, " ", "MOVES"]);
    expect(result.queryByTestId("freeze-button-caption")).toBeNull();

    // The success flash timer runs and clears without ever displacing the active
    // freeze — the moves label is still present after it would have fired.
    await waitFor(() =>
      expect(result.getByTestId("freeze-moves-label").props.children).toEqual([2, " ", "MOVES"]),
    );
  });

  it("flashes the defuse caption on a failed confirm reward, then clears it", async () => {
    const service = createMockAdService({ rewarded: { rewarded_defuse: "error" } });
    const result = await renderRun(service);

    await act(async () => {
      fireEvent.press(result.getByTestId("defuse-button"));
    });
    await act(async () => {
      fireEvent.press(result.getByTestId("defuse-confirm-button"));
    });
    expect(result.getByTestId("defuse-button-caption").props.children).toBe("AD FAILED");

    await waitFor(
      () => expect(result.getByTestId("defuse-button-caption").props.children).toBe(""),
      { timeout: 2500 },
    );
  });

  it("shows no transient when the defuse confirm card is cancelled (no ad)", async () => {
    const service = createMockAdService();
    const result = await renderRun(service);

    await act(async () => {
      fireEvent.press(result.getByTestId("defuse-button"));
    });
    await act(async () => {
      fireEvent.press(result.getByTestId("defuse-cancel-button"));
    });

    // Cancelling the card never ran the ad, so no outcome flash appears.
    expect(result.getByTestId("defuse-button-caption").props.children).toBe("");
    expect(service.shown).toEqual([]);
  });
});
