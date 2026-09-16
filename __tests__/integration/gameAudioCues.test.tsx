import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { GameScreenContent } from "../../app/game";
import { createInitialGameState } from "../../src/domain/game";
import { createNoOpAudioService } from "../../src/services/audio/NoOpAudioService";
import type { AudioService } from "../../src/services/audio";
import type { GameState, GridCell } from "../../src/domain/gameTypes";

const NOW = 1_752_800_000_000;

function playingRun(): GameState {
  const grid: GridCell[][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, (): GridCell => ({ kind: "empty" })),
  );
  grid[0][0] = { kind: "normal", colorId: "cyan" };
  return {
    ...createInitialGameState("cues-seed", NOW),
    status: "playing",
    grid,
    hand: [{ handId: "h-square", shapeId: "square2x2", colorId: "purple" }],
  };
}

describe("game audio UI cues", () => {
  it("plays selection, invalid, and button effects from UI events", async () => {
    const audio = createNoOpAudioService();
    const result = await render(
      <GameScreenContent
        controllerOptions={{ seed: "cues-seed", now: () => NOW, initialState: playingRun() }}
        boardSize={328}
        audioService={audio}
      />,
    );
    await waitFor(() => expect(audio.musicCalls).toContain("start"));

    // Touch-down is the semantic pickup boundary; tap completion selects it.
    await fireEvent(result.getByTestId("tray-piece-h-square"), "pressIn");
    await fireEvent.press(result.getByTestId("tray-piece-h-square"));
    // Place onto the occupied origin (0,0) -> rejected -> invalid cue.
    await fireEvent.press(result.getByTestId("cell-0-0"));
    // Open the pause menu -> button cue.
    await fireEvent.press(result.getByTestId("pause-button"));

    expect(audio.cues.map((request) => request.cue)).toEqual(
      expect.arrayContaining(["piecePickup", "invalidPlacement", "uiTap"]),
    );
  });

  it("keeps gameplay functional when every audio provider call fails", async () => {
    const fail = () => {
      throw new Error("audio provider unavailable");
    };
    const audio: AudioService = {
      preload: jest.fn(fail),
      configure: jest.fn(fail),
      play: jest.fn(fail),
      startMusic: jest.fn(fail),
      pauseMusic: jest.fn(fail),
      resumeMusic: jest.fn(fail),
      stopMusic: jest.fn(fail),
      suspend: jest.fn(fail),
      resume: jest.fn(fail),
      stopAll: jest.fn(fail),
      release: jest.fn(fail),
    };
    const result = await render(
      <GameScreenContent
        controllerOptions={{ seed: "cues-seed", now: () => NOW, initialState: playingRun() }}
        boardSize={328}
        audioService={audio}
      />,
    );
    await waitFor(() => expect(audio.configure).toHaveBeenCalled());

    await fireEvent(result.getByTestId("tray-piece-h-square"), "pressIn");
    await fireEvent.press(result.getByTestId("tray-piece-h-square"));
    await fireEvent.press(result.getByTestId("cell-2-2"));

    expect(result.queryByTestId("tray-piece-h-square")).toBeNull();
    expect(result.getByTestId("cell-2-2")).toBeTruthy();
  });
});
