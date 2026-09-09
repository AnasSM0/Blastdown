import { fireEvent, render } from "@testing-library/react-native";

import GameScreen from "../../app/game";
import { createInitialGameState } from "../../src/domain/game";
import type { GameController } from "../../src/hooks/useGameController";
import { AdServiceProvider } from "../../src/services/ads";
import { AudioServiceProvider } from "../../src/services/audio";
import { StorageServiceProvider, createMemoryStorageService } from "../../src/services/storage";
import { ProfileProvider } from "../../src/state/ProfileProvider";
import { SettingsProvider } from "../../src/state/SettingsProvider";

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockClearActiveRun = jest.fn();
const mockStartNewRun = jest.fn();

const mockController: GameController = {
  state: {
    ...createInitialGameState("completed-route-run", 1_752_800_000_000),
    status: "gameOver",
  },
  sessionGeneration: 0,
  selectedHandId: null,
  lastEvents: [],
  selectPiece: jest.fn(),
  clearSelection: jest.fn(),
  previewAt: jest.fn(() => null),
  placeAt: jest.fn(() => false),
  previewFor: jest.fn(() => null),
  createPlacementIntent: jest.fn(() => null),
  place: jest.fn(() => false),
  activateFreeze: jest.fn(() => false),
  defuse: jest.fn(() => false),
  revive: jest.fn(() => false),
  hydrate: jest.fn(),
  restart: jest.fn(),
};

jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
    back: mockBack,
    canGoBack: () => true,
  }),
}));

jest.mock("../../src/state/GameSessionProvider", () => ({
  useGameSession: () => ({
    controller: mockController,
    startNewRun: mockStartNewRun,
    clearActiveRun: mockClearActiveRun,
    flushActiveRun: () => Promise.resolve(),
  }),
}));

describe("game-over route finalization", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockPush.mockClear();
    mockBack.mockClear();
    mockClearActiveRun.mockClear();
  });

  async function renderCompletedGame() {
    return render(
      <StorageServiceProvider service={createMemoryStorageService()}>
        <SettingsProvider>
          <ProfileProvider>
            <AudioServiceProvider>
              <AdServiceProvider>
                <GameScreen />
              </AdServiceProvider>
            </AudioServiceProvider>
          </ProfileProvider>
        </SettingsProvider>
      </StorageServiceProvider>,
    );
  }

  it("finalizes the active run and replaces Game with Results", async () => {
    const result = await renderCompletedGame();

    await fireEvent.press(result.getByTestId("end-run-button"));

    expect(mockClearActiveRun).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/results");
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("coalesces duplicate End Run transitions", async () => {
    const result = await renderCompletedGame();
    const endRun = result.getByTestId("end-run-button");

    await fireEvent.press(endRun);
    await fireEvent.press(endRun);

    expect(mockClearActiveRun).toHaveBeenCalledTimes(1);
    expect(mockReplace.mock.calls.filter(([route]) => route === "/results")).toHaveLength(1);
  });
});
