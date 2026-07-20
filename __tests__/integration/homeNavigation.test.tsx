import { fireEvent, render } from "@testing-library/react-native";

import { StorageServiceProvider, createMemoryStorageService } from "../../src/services/storage";
import { GameSessionProvider } from "../../src/state/GameSessionProvider";
import { ProfileProvider } from "../../src/state/ProfileProvider";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: () => true,
  }),
}));

function renderHome() {
  // Loaded after jest.mock so the expo-router stub is in place.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const HomeScreen = require("../../app/index").default;
  return render(
    <StorageServiceProvider service={createMemoryStorageService()}>
      <ProfileProvider>
        <GameSessionProvider>
          <HomeScreen />
        </GameSessionProvider>
      </ProfileProvider>
    </StorageServiceProvider>,
  );
}

describe("Home route wiring", () => {
  beforeEach(() => mockPush.mockClear());

  it("starts a fresh run and navigates to the game on Play, then offers Continue", async () => {
    const result = await renderHome();

    // No active run yet, so Continue is hidden.
    expect(result.queryByTestId("continue-button")).toBeNull();

    fireEvent.press(result.getByTestId("play-button"));

    expect(mockPush).toHaveBeenCalledWith("/game");
    // The run is now active, so Continue becomes available (state flushes async).
    expect(await result.findByTestId("continue-button")).toBeTruthy();
  });

  it("navigates to the game without resetting when Continue is used", async () => {
    const result = await renderHome();
    fireEvent.press(result.getByTestId("play-button"));
    const continueButton = await result.findByTestId("continue-button");
    mockPush.mockClear();

    fireEvent.press(continueButton);
    expect(mockPush).toHaveBeenCalledWith("/game");
  });
});
