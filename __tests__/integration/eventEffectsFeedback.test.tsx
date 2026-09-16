import { render, userEvent, waitFor } from "@testing-library/react-native";

import { GameScreenContent } from "../../app/game";
import { createInitialGameState } from "../../src/domain/game";
import type { GameState, GridCell } from "../../src/domain/gameTypes";
import { createNoOpAudioService } from "../../src/services/audio";

const NOW = 1_752_800_000_000;

function makeEmptyGrid(size: number): GridCell[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, (): GridCell => ({ kind: "empty" })),
  );
}

function options(initialState: GameState) {
  return { seed: "fx-seed", now: () => NOW, nextSeed: () => "restart", initialState };
}

/** One move away from clearing row 0 — the hand's single completes it. */
function clearingState(): GameState {
  const grid = makeEmptyGrid(8);
  for (let column = 1; column < 8; column++) {
    grid[0][column] = { kind: "normal", colorId: "cyan" };
  }
  return {
    ...createInitialGameState("fx-seed", NOW),
    grid,
    hand: [
      { handId: "h-single", shapeId: "single", colorId: "amber" },
      { handId: "h-spare", shapeId: "single", colorId: "purple" },
    ],
  };
}

describe("line-clear feedback", () => {
  it("plays the clear overlay over the cells the engine cleared, then removes it", async () => {
    const user = userEvent.setup();
    const result = await render(
      <GameScreenContent controllerOptions={options(clearingState())} boardSize={328} />,
    );

    await user.press(result.getByTestId("tray-piece-h-single"));
    await user.press(result.getByTestId("cell-0-0"));

    // Exactly the eight cells of the cleared row are flashed — no more, no less.
    await waitFor(() => expect(result.getByTestId("effects-layer")).toBeTruthy());
    expect(result.getAllByTestId(/^clear-flash-0-\d$/)).toHaveLength(8);
    expect(result.queryByTestId("clear-flash-1-0")).toBeNull();

    // The board is authoritative and updated immediately, not after the effect.
    expect(result.getAllByTestId(/^cell-\d+-\d+$/)).toHaveLength(64);

    await waitFor(() => expect(result.queryByTestId("effects-layer")).toBeNull(), {
      timeout: 2000,
    });
    // Still 64 cells once the overlay is gone.
    expect(result.getAllByTestId(/^cell-\d+-\d+$/)).toHaveLength(64);
  });

  it("plays one dominant outcome cue exactly once for a clear-plus-defuse turn", async () => {
    const user = userEvent.setup();
    const audio = createNoOpAudioService();
    const result = await render(
      <GameScreenContent
        controllerOptions={options(clearingState())}
        audioService={audio}
        boardSize={328}
      />,
    );
    await waitFor(() => expect(audio.musicCalls).toContain("start"));

    await user.press(result.getByTestId("tray-piece-h-single"));
    await user.press(result.getByTestId("cell-0-0"));

    await waitFor(() => expect(audio.cues.some(({ cue }) => cue === "naturalDefuse")).toBe(true));
    expect(audio.cues.filter(({ cue }) => cue === "naturalDefuse")).toHaveLength(1);
    // Defuse outranks the simultaneous clear; neither lower-priority clear nor
    // placement layers underneath it.
    expect(audio.cues.some(({ cue }) => cue === "clearSingle")).toBe(false);
    expect(audio.cues.some(({ cue }) => cue === "validPlacement")).toBe(false);
  });
});

describe("effect cleanup", () => {
  it("drops a playing sequence when the run is restarted from the pause menu", async () => {
    const user = userEvent.setup();
    const result = await render(
      <GameScreenContent controllerOptions={options(clearingState())} boardSize={328} />,
    );

    await user.press(result.getByTestId("tray-piece-h-single"));
    await user.press(result.getByTestId("cell-0-0"));
    await waitFor(() => expect(result.getByTestId("effects-layer")).toBeTruthy());

    await user.press(result.getByTestId("pause-button"));
    await user.press(result.getByTestId("pause-restart-button"));

    // The overlay is gone at once — a fresh run never inherits the old run's
    // effects, and nothing is left to fire on a timer afterwards.
    await waitFor(() => expect(result.queryByTestId("effects-layer")).toBeNull());
    expect(result.getAllByTestId(/^cell-\d+-\d+$/)).toHaveLength(64);
  });

  it("unmounts mid-sequence without leaking a pending effect timer", async () => {
    const user = userEvent.setup();
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    const result = await render(
      <GameScreenContent controllerOptions={options(clearingState())} boardSize={328} />,
    );

    await user.press(result.getByTestId("tray-piece-h-single"));
    await user.press(result.getByTestId("cell-0-0"));
    await waitFor(() => expect(result.getByTestId("effects-layer")).toBeTruthy());

    await result.unmount();
    // Let any timer that survived unmount come due.
    await new Promise((resolve) => setTimeout(resolve, 700));

    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    warn.mockRestore();
    error.mockRestore();
  });
});
