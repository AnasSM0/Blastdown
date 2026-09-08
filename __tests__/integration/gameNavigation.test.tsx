import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { createInitialGameState } from "../../src/domain/game";
import { AdServiceProvider } from "../../src/services/ads";
import { AudioServiceProvider } from "../../src/services/audio";
import {
  StorageServiceProvider,
  STORAGE_KEYS,
  createMemoryStorageService,
  writeActiveRun,
  type MemoryStorageService,
} from "../../src/services/storage";
import { GameSessionProvider, useGameSession } from "../../src/state/GameSessionProvider";
import { ProfileProvider } from "../../src/state/ProfileProvider";
import { SettingsProvider } from "../../src/state/SettingsProvider";

const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    replace: mockReplace,
    canGoBack: () => true,
  }),
}));

function renderGame(storage: MemoryStorageService = createMemoryStorageService()) {
  // Loaded after jest.mock so the expo-router stub is in place.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const GameScreen = require("../../app/game").default;
  return render(
    <StorageServiceProvider service={storage}>
      <SettingsProvider>
        <ProfileProvider>
          <AudioServiceProvider>
            <AdServiceProvider>
              <GameSessionProvider>
                <>
                  <SessionGenerationProbe />
                  <GameScreen />
                </>
              </GameSessionProvider>
            </AdServiceProvider>
          </AudioServiceProvider>
        </ProfileProvider>
      </SettingsProvider>
    </StorageServiceProvider>,
  );
}

function SessionGenerationProbe() {
  const { sessionGeneration } = useGameSession();
  return <Text testID="session-generation">{sessionGeneration}</Text>;
}

describe("game navigation", () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  it("replaces the route with Home from Pause after the active-run flush", async () => {
    const result = await renderGame();
    await fireEvent.press(result.getByTestId("pause-button"));
    await fireEvent.press(result.getByTestId("pause-home-button"));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"));
  });

  it("preserves a resumed run through Pause to Home so Home offers Continue", async () => {
    const storage = createMemoryStorageService();
    const saved = { ...createInitialGameState("pause-home-saved", 1_752_800_000_000), score: 321 };
    await writeActiveRun(storage, saved, 1, 1_752_800_000_100);
    const result = await renderGame(storage);
    await result.findByText("321");
    await fireEvent.press(result.getByTestId("pause-button"));
    await fireEvent.press(result.getByTestId("pause-home-button"));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"));
    await result.unmount();

    // Loaded after the same router mock, and mounted over the same storage to
    // exercise the real persistence + hydration boundary.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const HomeScreen = require("../../app/index").default;
    const home = await render(
      <StorageServiceProvider service={storage}>
        <SettingsProvider>
          <ProfileProvider>
            <GameSessionProvider>
              <HomeScreen />
            </GameSessionProvider>
          </ProfileProvider>
        </SettingsProvider>
      </StorageServiceProvider>,
    );
    expect(await home.findByTestId("continue-button")).toBeTruthy();
    expect(home.getByText("CONTINUE")).toBeTruthy();
  });

  it("Restart confirmation creates a fresh session generation through GameSession", async () => {
    const storage = createMemoryStorageService();
    const result = await renderGame(storage);
    expect(result.getByTestId("session-generation").props.children).toBe(0);
    await fireEvent.press(result.getByTestId("pause-button"));
    await fireEvent.press(result.getByTestId("pause-restart-button"));

    await fireEvent.press(result.getByTestId("restart-confirm-button"));

    expect(result.getByTestId("session-generation").props.children).toBe(1);
    await waitFor(() => expect(storage.store.has(STORAGE_KEYS.activeRun)).toBe(true));
    expect(result.queryByTestId("pause-overlay")).toBeNull();
  });

  it("coalesces rapid duplicate Pause to Home transitions", async () => {
    const result = await renderGame();
    await fireEvent.press(result.getByTestId("pause-button"));
    const home = result.getByTestId("pause-home-button");

    await fireEvent.press(home);
    await fireEvent.press(home);

    expect(mockReplace.mock.calls.filter(([route]) => route === "/")).toHaveLength(1);
  });
});
