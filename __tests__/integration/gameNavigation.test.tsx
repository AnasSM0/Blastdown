import { fireEvent, render } from "@testing-library/react-native";

import { AdServiceProvider } from "../../src/services/ads";
import { GameSessionProvider } from "../../src/state/GameSessionProvider";

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = { value: true };

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: mockBack,
    replace: mockReplace,
    canGoBack: () => mockCanGoBack.value,
  }),
}));

function renderGame() {
  // Loaded after jest.mock so the expo-router stub is in place.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const GameScreen = require("../../app/game").default;
  return render(
    <AdServiceProvider>
      <GameSessionProvider>
        <GameScreen />
      </GameSessionProvider>
    </AdServiceProvider>,
  );
}

describe("game navigation", () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockReplace.mockClear();
    mockCanGoBack.value = true;
  });

  it("returns to the previous screen (Home) from the pause control", async () => {
    const result = await renderGame();
    fireEvent.press(result.getByTestId("pause-button"));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("falls back to replacing Home when there is nothing to go back to", async () => {
    mockCanGoBack.value = false;
    const result = await renderGame();
    fireEvent.press(result.getByTestId("pause-button"));
    expect(mockReplace).toHaveBeenCalledWith("/");
  });
});
