import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import { createInitialGameState } from "../../src/domain/game";
import {
  STORAGE_KEYS,
  StorageServiceProvider,
  createMemoryStorageService,
  loadActiveRun,
  type StorageService,
  writeActiveRun,
} from "../../src/services/storage";
import { GameSessionProvider } from "../../src/state/GameSessionProvider";
import { ProfileProvider } from "../../src/state/ProfileProvider";
import { SettingsProvider } from "../../src/state/SettingsProvider";

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
    replace: mockReplace,
    canGoBack: () => true,
  }),
}));

function renderHome(storage: StorageService = createMemoryStorageService()) {
  // Loaded after jest.mock so the expo-router stub is in place.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const HomeScreen = require("../../app/index").default;
  return render(
    // Mirrors the real provider stack (app/_layout): the Home route reads the
    // effective reduced-motion setting for its button press feedback, so it
    // renders under SettingsProvider like it does in production.
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
}

function deferred<T>() {
  let resolve: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return {
    promise,
    resolve: (value: T) => resolve?.(value),
  };
}

describe("Home route wiring", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
  });

  async function waitForRunActions(result: Awaited<ReturnType<typeof renderHome>>) {
    await waitFor(() =>
      expect(result.getByTestId("play-button").props.accessibilityState).toEqual({
        disabled: false,
      }),
    );
  }

  function gameReplacementCount(): number {
    return mockReplace.mock.calls.filter(([route]) => route === "/game").length;
  }

  async function storageWithSavedRun() {
    const storage = createMemoryStorageService();
    const saved = { ...createInitialGameState("saved-home-run", 1_752_800_000_000), score: 900 };
    await writeActiveRun(storage, saved, 1, 1_752_800_000_100);
    return { storage, saved };
  }

  it("starts a fresh run and replaces Home with the game on Play", async () => {
    const result = await renderHome();
    await waitForRunActions(result);

    // No active run yet, so Continue is hidden.
    expect(result.queryByTestId("continue-button")).toBeNull();

    await fireEvent.press(result.getByTestId("play-button"));

    expect(mockReplace).toHaveBeenCalledWith("/game");
    expect(mockPush).not.toHaveBeenCalledWith("/game");
  });

  it("makes Continue primary and keeps the exact saved session when it is used", async () => {
    const { storage, saved } = await storageWithSavedRun();
    const result = await renderHome(storage);
    const continueButton = await result.findByTestId("continue-button");
    expect(result.getByText("CONTINUE")).toBeTruthy();
    expect(result.getByText("NEW GAME")).toBeTruthy();

    await fireEvent.press(continueButton);
    expect(mockReplace).toHaveBeenCalledWith("/game");
    expect((await loadActiveRun(storage))?.state.seed).toBe(saved.seed);
  });

  it("coalesces a rapid double Continue without replacing the saved session", async () => {
    const { storage, saved } = await storageWithSavedRun();
    const result = await renderHome(storage);
    const continueButton = await result.findByTestId("continue-button");

    await fireEvent.press(continueButton);
    await fireEvent.press(continueButton);

    expect(gameReplacementCount()).toBe(1);
    expect((await loadActiveRun(storage))?.state.seed).toBe(saved.seed);
  });

  it("requires confirmation before New Game can replace a saved run", async () => {
    const { storage, saved } = await storageWithSavedRun();
    const result = await renderHome(storage);
    await result.findByTestId("continue-button");

    await fireEvent.press(result.getByTestId("play-button"));

    expect(result.getByTestId("new-game-confirm")).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalledWith("/game");
    expect((await loadActiveRun(storage))?.state.seed).toBe(saved.seed);
  });

  it("cancelling New Game preserves the saved run", async () => {
    const { storage, saved } = await storageWithSavedRun();
    const result = await renderHome(storage);
    await result.findByTestId("continue-button");
    await fireEvent.press(result.getByTestId("play-button"));

    await fireEvent.press(result.getByTestId("new-game-cancel-button"));

    expect(result.queryByTestId("new-game-confirm")).toBeNull();
    expect(mockReplace).not.toHaveBeenCalledWith("/game");
    expect((await loadActiveRun(storage))?.state.seed).toBe(saved.seed);
  });

  it("confirming New Game creates and persists a fresh session generation", async () => {
    const { storage, saved } = await storageWithSavedRun();
    const result = await renderHome(storage);
    await result.findByTestId("continue-button");
    await fireEvent.press(result.getByTestId("play-button"));

    await fireEvent.press(result.getByTestId("new-game-confirm-button"));

    expect(gameReplacementCount()).toBe(1);
    expect(mockReplace).toHaveBeenCalledWith("/game");
    await waitFor(async () =>
      expect((await loadActiveRun(storage))?.state.seed).not.toBe(saved.seed),
    );
  });

  it("coalesces a rapid double Play into one run transition", async () => {
    const result = await renderHome();
    await waitForRunActions(result);
    const play = result.getByTestId("play-button");

    await fireEvent.press(play);
    await fireEvent.press(play);

    expect(gameReplacementCount()).toBe(1);
  });

  it("does not allow Play to navigate until active-run hydration resolves", async () => {
    const memory = createMemoryStorageService();
    const activeRunRead = deferred<string | null>();
    const storage: StorageService = {
      ...memory,
      getItem: (key) =>
        key === STORAGE_KEYS.activeRun ? activeRunRead.promise : memory.getItem(key),
    };
    const result = await renderHome(storage);

    await fireEvent.press(result.getByTestId("play-button"));
    expect(mockReplace).not.toHaveBeenCalledWith("/game");

    await act(async () => {
      activeRunRead.resolve(null);
      await activeRunRead.promise;
    });
    await waitFor(() =>
      expect(result.getByTestId("play-button").props.accessibilityState).toEqual({
        disabled: false,
      }),
    );

    await fireEvent.press(result.getByTestId("play-button"));
    expect(mockReplace).toHaveBeenCalledWith("/game");
  });
});
