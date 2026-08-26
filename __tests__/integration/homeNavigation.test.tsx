import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import {
  STORAGE_KEYS,
  StorageServiceProvider,
  createMemoryStorageService,
  type StorageService,
} from "../../src/services/storage";
import { GameSessionProvider } from "../../src/state/GameSessionProvider";
import { ProfileProvider } from "../../src/state/ProfileProvider";
import { SettingsProvider } from "../../src/state/SettingsProvider";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
    replace: jest.fn(),
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
  beforeEach(() => mockPush.mockClear());

  it("starts a fresh run and navigates to the game on Play, then offers Continue", async () => {
    const result = await renderHome();

    // No active run yet, so Continue is hidden.
    expect(result.queryByTestId("continue-button")).toBeNull();

    await fireEvent.press(result.getByTestId("play-button"));

    expect(mockPush).toHaveBeenCalledWith("/game");
    // The run is now active, so Continue becomes available (state flushes async).
    expect(await result.findByTestId("continue-button")).toBeTruthy();
  });

  it("navigates to the game without resetting when Continue is used", async () => {
    const result = await renderHome();
    await fireEvent.press(result.getByTestId("play-button"));
    const continueButton = await result.findByTestId("continue-button");
    mockPush.mockClear();

    await fireEvent.press(continueButton);
    expect(mockPush).toHaveBeenCalledWith("/game");
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

    fireEvent.press(result.getByTestId("play-button"));
    expect(mockPush).not.toHaveBeenCalledWith("/game");

    await act(async () => {
      activeRunRead.resolve(null);
      await activeRunRead.promise;
    });
    await waitFor(() =>
      expect(result.getByTestId("play-button").props.accessibilityState).toEqual({
        disabled: false,
      }),
    );

    fireEvent.press(result.getByTestId("play-button"));
    expect(mockPush).toHaveBeenCalledWith("/game");
  });
});
