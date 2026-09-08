import { act, fireEvent, render } from "@testing-library/react-native";
import { BackHandler } from "react-native";

// Imported at module scope, not required inside the test: `jest.mock` calls are
// hoisted above imports, and loading the route here keeps its (substantial)
// first-time transform cost out of whichever test happens to run first.
import ResultsScreen from "../../app/results";
import { createInitialGameState } from "../../src/domain/game";
import type { GameState } from "../../src/domain/gameTypes";
import { AudioServiceProvider } from "../../src/services/audio";
import { StorageServiceProvider, createMemoryStorageService } from "../../src/services/storage";
import { SettingsProvider } from "../../src/state/SettingsProvider";

const NOW = 1_752_800_000_000;
const mockReplace = jest.fn();
const mockStartNewRun = jest.fn();
const mockSettle = jest.fn();
const mockClearActiveRun = jest.fn();
const mockBack = jest.fn();

const mockFinishedState: GameState = {
  ...createInitialGameState("results-seed", NOW),
  status: "gameOver",
  score: 14200,
  bestCombo: 12,
  linesCleared: 48,
  piecesDefused: 156,
  explosions: 22,
  rubbleCleared: 89,
};

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: mockBack }),
}));

jest.mock("../../src/state/GameSessionProvider", () => ({
  useGameSession: () => ({
    controller: { state: mockFinishedState },
    startNewRun: mockStartNewRun,
    clearActiveRun: mockClearActiveRun,
    settleCurrentRun: mockSettle,
  }),
}));

jest.mock("../../src/state/ProfileProvider", () => ({
  useProfile: () => ({
    profile: { bestScore: 20000, bolts: 500 },
    loaded: true,
    updateProfile: jest.fn(),
  }),
}));

describe("results route", () => {
  let hardwareBack: Parameters<typeof BackHandler.addEventListener>[1] | undefined;
  let backSubscription: jest.SpyInstance;

  beforeEach(() => {
    mockReplace.mockClear();
    mockStartNewRun.mockClear();
    mockSettle.mockClear();
    mockClearActiveRun.mockClear();
    mockBack.mockClear();
    hardwareBack = undefined;
    backSubscription = jest
      .spyOn(BackHandler, "addEventListener")
      .mockImplementation((_event, handler) => {
        hardwareBack = handler;
        return { remove: jest.fn() };
      });
  });

  afterEach(() => backSubscription.mockRestore());

  function renderResults() {
    // Mirrors the real provider stack (app/_layout): the route plays the shared
    // reward outcome feedback, which reads the persisted sound/haptics settings
    // and the audio service.
    return render(
      <StorageServiceProvider service={createMemoryStorageService()}>
        <SettingsProvider>
          <AudioServiceProvider>
            <ResultsScreen />
          </AudioServiceProvider>
        </SettingsProvider>
      </StorageServiceProvider>,
    );
  }

  it("shows the finished run's V1 stats and best score without legacy rewards", async () => {
    const result = await renderResults();
    expect(result.getByTestId("results-score").props.children).toBe("14,200");
    expect(result.getByTestId("results-best").props.children).toEqual(["BEST: ", "20,000"]);
    expect(result.queryByText(/bolts/i)).toBeNull();
    expect(result.queryByTestId("double-bolts-button")).toBeNull();
    expect(result.getByText("x12")).toBeTruthy();
    expect(result.getByText("156")).toBeTruthy();
  });

  it("settles the finished run exactly once on mount", async () => {
    await renderResults();
    expect(mockSettle).toHaveBeenCalledTimes(1);
    expect(mockClearActiveRun).toHaveBeenCalledTimes(1);
  });

  it("Play Again starts a fresh run and navigates to the game", async () => {
    const result = await renderResults();
    await fireEvent.press(result.getByTestId("play-again-button"));
    expect(mockStartNewRun).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/game");
  });

  it("Home returns to the menu", async () => {
    const result = await renderResults();
    await fireEvent.press(result.getByTestId("results-home-button"));
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("coalesces rapid duplicate Home presses", async () => {
    const result = await renderResults();
    const home = result.getByTestId("results-home-button");

    await fireEvent.press(home);
    await fireEvent.press(home);

    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("hardware Back replaces Results with Home and never reveals completed gameplay", async () => {
    await renderResults();

    await act(async () => {
      expect(hardwareBack).toBeDefined();
      expect(hardwareBack?.({ type: "hardwareBackPress", timeStamp: Date.now() })).toBe(true);
    });

    expect(mockReplace).toHaveBeenCalledWith("/");
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("coalesces rapid duplicate Play Again presses", async () => {
    const result = await renderResults();
    const playAgain = result.getByTestId("play-again-button");

    await fireEvent.press(playAgain);
    await fireEvent.press(playAgain);

    expect(mockStartNewRun).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/game");
  });
});
