import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import { createMemoryStorageService } from "../../src/services/storage/StorageService";
import { StorageServiceProvider } from "../../src/services/storage/StorageServiceProvider";
import { loadSettings } from "../../src/services/storage/settingsStorage";
import { SettingsProvider } from "../../src/state/SettingsProvider";

const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: jest.fn(), canGoBack: () => true }),
}));

async function renderSettings(storage = createMemoryStorageService()) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SettingsScreen = require("../../app/settings").default;
  const utils = await render(
    <StorageServiceProvider service={storage}>
      <SettingsProvider>
        <SettingsScreen />
      </SettingsProvider>
    </StorageServiceProvider>,
  );
  return { ...utils, storage };
}

describe("settings screen", () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockPush.mockClear();
  });

  it("persists a toggle change through the provider", async () => {
    const { getByTestId, storage } = await renderSettings();

    await act(async () => {
      fireEvent(getByTestId("setting-soundEnabled"), "valueChange", false);
    });

    await waitFor(async () => {
      const stored = await loadSettings(storage);
      expect(stored.soundEnabled).toBe(false);
    });
  });

  it("navigates back", async () => {
    const { getByTestId } = await renderSettings();
    await act(async () => {
      fireEvent.press(getByTestId("settings-back-button"));
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("navigates to Themes and to the tutorial replay", async () => {
    const { getByTestId } = await renderSettings();
    await act(async () => {
      fireEvent.press(getByTestId("settings-themes-button"));
    });
    expect(mockPush).toHaveBeenCalledWith("/themes");

    await act(async () => {
      fireEvent.press(getByTestId("settings-replay-tutorial-button"));
    });
    expect(mockPush).toHaveBeenCalledWith("/tutorial");
  });
});
