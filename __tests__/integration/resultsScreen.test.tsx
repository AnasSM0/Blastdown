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

// Mirrors the real session's once-per-run guard: the first call applies and
// banks, every later call for the same run returns false and banks nothing.
// Prefixed 'mock' so the jest.mock factory may reference it.
let mockRunDoubled = false;
const mockDoubleBolts = jest.fn(() => {
  if (mockRunDoubled) {
    return false;
  }
  mockRunDoubled = true;
  return true;
});

jest.mock("../../src/state/GameSessionProvider", () => ({
  useGameSession: () => ({
    controller: { state: mockFinishedState },
    startNewRun: mockStartNewRun,
    clearActiveRun: mockClearActiveRun,
    settleCurrentRun: mockSettle,
    doubleBoltsForCurrentRun: mockDoubleBolts,
    isCurrentRunDoubled: mockRunDoubled,
  }),
}));

// Stub the rewarded action so the route renders without an AdServiceProvider;
// `run` immediately invokes the earn callback so the double-Bolts path applies.
jest.mock("../../src/hooks/useRewardedAction", () => ({
  useRewardedAction: () => ({
    run: (_placement: string, onEarned: () => void) => {
      onEarned();
      return Promise.resolve("earned");
    },
    pending: false,
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
    mockDoubleBolts.mockClear();
    mockRunDoubled = false;
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

  it("shows the finished run's real stats, best score, and Bolts earned", async () => {
    const result = await renderResults();
    expect(result.getByTestId("results-score").props.children).toBe("14,200");
    expect(result.getByTestId("results-best").props.children).toEqual(["BEST: ", "20,000"]);
    // floor(14200 / 250) + 156 defuses = 56 + 156 = 212
    expect(result.getByText("+212")).toBeTruthy();
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

  it("double Bolts applies once and swaps to the applied state", async () => {
    const result = await renderResults();
    // Earned Bolts (212) > 0, so the offer is shown.
    expect(result.getByTestId("double-bolts-button")).toBeTruthy();

    await fireEvent.press(result.getByTestId("double-bolts-button"));

    expect(mockDoubleBolts).toHaveBeenCalledTimes(1);
    // The offer is replaced by the applied confirmation, so it can't be pressed
    // again (one-time reward).
    expect(result.getByTestId("double-bolts-applied")).toBeTruthy();
    expect(result.queryByTestId("double-bolts-button")).toBeNull();
  });

  it("keeps the reward applied across a remount instead of re-offering it", async () => {
    const first = await renderResults();
    await fireEvent.press(first.getByTestId("double-bolts-button"));
    expect(mockDoubleBolts).toHaveBeenCalledTimes(1);
    // `unmount` is async and opens its own act() scope. Leaving it un-awaited
    // lets the next render open a second, overlapping scope, which React
    // refuses — the following renders then produce an empty tree.
    await first.unmount();

    // Back / Home-and-in-again remounts the route. The applied state must come
    // from the session's own guard, not from screen-local state — otherwise the
    // offer returns and the player spends an ad view on a reward that can no
    // longer be applied.
    const second = await renderResults();
    expect(second.getByTestId("double-bolts-applied")).toBeTruthy();
    expect(second.queryByTestId("double-bolts-button")).toBeNull();
    expect(mockDoubleBolts).toHaveBeenCalledTimes(1);
  });

  it("never reports success when an earned ad banked nothing", async () => {
    // Force the offer to be visible while the session guard is already spent —
    // the state in which an earned ad grants nothing. Reporting "done" here
    // would tell the player they received Bolts they did not receive.
    mockDoubleBolts.mockImplementationOnce(() => false);
    const result = await renderResults();

    await fireEvent.press(result.getByTestId("double-bolts-button"));

    const notice = await result.findByTestId("double-bolts-outcome");
    expect(notice.props.children).toMatch(/not applied/i);
    expect(notice.props.children).not.toMatch(/done/i);
    // Nothing was banked, so the applied confirmation must not appear either.
    expect(result.queryByTestId("double-bolts-applied")).toBeNull();
  });
});
