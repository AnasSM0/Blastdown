import { fireEvent, render } from "@testing-library/react-native";

import { GameScreenContent } from "../../app/game";
import { createInitialGameState } from "../../src/domain/game";
import { createNoOpAudioService } from "../../src/services/audio/NoOpAudioService";
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

    // Select a piece -> selection cue.
    await fireEvent.press(result.getByTestId("tray-piece-h-square"));
    // Place onto the occupied origin (0,0) -> rejected -> invalid cue.
    await fireEvent.press(result.getByTestId("cell-0-0"));
    // Open the pause menu -> button cue.
    await fireEvent.press(result.getByTestId("pause-button"));

    expect(audio.sfx).toContain("selection");
    expect(audio.sfx).toContain("invalid");
    expect(audio.sfx).toContain("button");
  });
});
