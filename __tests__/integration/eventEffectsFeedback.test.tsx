import { render, userEvent, waitFor } from "@testing-library/react-native";

import { GameScreenContent } from "../../app/game";
import { createInitialGameState } from "../../src/domain/game";
import type { GameState, GridCell } from "../../src/domain/gameTypes";
import type { AdService, RewardedPlacement, RewardedResult } from "../../src/services/ads";
import type { AudioService, SfxName } from "../../src/services/audio";

const NOW = 1_752_800_000_000;

function makeEmptyGrid(size: number): GridCell[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, (): GridCell => ({ kind: "empty" })),
  );
}

function options(initialState: GameState) {
  return { seed: "fx-seed", now: () => NOW, nextSeed: () => "restart", initialState };
}

/** Records every effect played, so a duplicate is visible as a repeated name. */
function recordingAudio(): AudioService & { played: SfxName[] } {
  const played: SfxName[] = [];
  return {
    played,
    playSfx: (name: SfxName) => played.push(name),
    startMusic: () => {},
    pauseMusic: () => {},
    resumeMusic: () => {},
    stopMusic: () => {},
    release: () => {},
  };
}

/** An ad service with a scripted outcome, counting how often it was asked. */
function scriptedAds(result: RewardedResult): AdService & { calls: RewardedPlacement[] } {
  const calls: RewardedPlacement[] = [];
  return {
    calls,
    showRewarded: (placement: RewardedPlacement) => {
      calls.push(placement);
      return Promise.resolve(result);
    },
  } as AdService & { calls: RewardedPlacement[] };
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

/** A game-over run with rubble on the board and its revive still available. */
function reviveState(): GameState {
  const grid = makeEmptyGrid(8);
  // Fill the board so no piece fits, leaving two rubble cells to restore.
  for (let row = 0; row < 8; row++) {
    for (let column = 0; column < 8; column++) {
      grid[row][column] = { kind: "normal", colorId: "cyan" };
    }
  }
  grid[3][3] = { kind: "rubble", explosionId: "e-1" };
  grid[4][4] = { kind: "rubble", explosionId: "e-1" };
  return {
    ...createInitialGameState("fx-seed", NOW),
    grid,
    status: "gameOver",
    hand: [{ handId: "h-1", shapeId: "square2", colorId: "cyan" }],
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

  it("plays the line-clear cue exactly once for the turn", async () => {
    const user = userEvent.setup();
    const audio = recordingAudio();
    const result = await render(
      <GameScreenContent
        controllerOptions={options(clearingState())}
        audioService={audio}
        boardSize={328}
      />,
    );

    await user.press(result.getByTestId("tray-piece-h-single"));
    await user.press(result.getByTestId("cell-0-0"));

    await waitFor(() => expect(audio.played).toContain("lineClear"));
    expect(audio.played.filter((name) => name === "lineClear")).toHaveLength(1);
    // The placement cue is also once, never re-fired by the effect replaying.
    expect(audio.played.filter((name) => name === "placement")).toHaveLength(1);
  });
});

describe("revive feedback", () => {
  it("plays a recovery wave over the restored rubble without duplicating restoration", async () => {
    const user = userEvent.setup();
    const ads = scriptedAds("earned");
    const result = await render(
      <GameScreenContent
        controllerOptions={options(reviveState())}
        adService={ads}
        boardSize={328}
      />,
    );

    await user.press(await result.findByTestId("revive-button"));

    // The wave covers exactly the two cells that held rubble before the revive.
    await waitFor(() => expect(result.getByTestId("revive-flash-3-3")).toBeTruthy());
    expect(result.getByTestId("revive-flash-4-4")).toBeTruthy();
    expect(result.queryByTestId("revive-flash-0-0")).toBeNull();

    // The reward was requested once, and the board is restored exactly once —
    // the cells are empty, not doubly-processed.
    expect(ads.calls).toHaveLength(1);
    expect(result.getByLabelText(/empty cell, row 4, column 4/i)).toBeTruthy();

    // The wave holds no input lock and cleans itself up.
    await waitFor(() => expect(result.queryByTestId("effects-layer")).toBeNull(), {
      timeout: 2000,
    });
  });

  it("reports a cancelled revive instead of failing silently, and grants nothing", async () => {
    const user = userEvent.setup();
    const ads = scriptedAds("closed");
    const result = await render(
      <GameScreenContent
        controllerOptions={options(reviveState())}
        adService={ads}
        boardSize={328}
      />,
    );

    await user.press(await result.findByTestId("revive-button"));

    const notice = await result.findByTestId("revive-outcome");
    expect(notice.props.children).toMatch(/cancelled/i);
    // Rubble is untouched: a dismissed ad grants nothing.
    expect(result.getByLabelText(/rubble.*row 4, column 4/i)).toBeTruthy();
    expect(result.queryByTestId("revive-flash-3-3")).toBeNull();
  });

  it("reports a failed revive as a failure, and still grants nothing", async () => {
    const user = userEvent.setup();
    const ads = scriptedAds("unavailable");
    const result = await render(
      <GameScreenContent
        controllerOptions={options(reviveState())}
        adService={ads}
        boardSize={328}
      />,
    );

    await user.press(await result.findByTestId("revive-button"));

    const notice = await result.findByTestId("revive-outcome");
    expect(notice.props.children).toMatch(/failed/i);
    expect(result.getByLabelText(/rubble.*row 4, column 4/i)).toBeTruthy();
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
