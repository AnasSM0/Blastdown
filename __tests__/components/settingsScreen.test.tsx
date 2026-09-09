import { fireEvent, render, waitFor } from "@testing-library/react-native";

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

    await fireEvent(getByTestId("setting-soundEnabled"), "valueChange", false);

    await waitFor(async () => {
      const stored = await loadSettings(storage);
      expect(stored.soundEnabled).toBe(false);
    });
  });

  it("navigates back", async () => {
    const { getByTestId } = await renderSettings();
    await fireEvent.press(getByTestId("settings-back-button"));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("has no Themes route and navigates to the tutorial replay", async () => {
    const { getByTestId, queryByTestId } = await renderSettings();
    expect(queryByTestId("settings-themes-button")).toBeNull();

    await fireEvent.press(getByTestId("settings-replay-tutorial-button"));
    expect(mockPush).toHaveBeenCalledWith("/tutorial");
  });

  it("uses the shared reactor environment", async () => {
    const { getByTestId } = await renderSettings();
    expect(getByTestId("reactor-background")).toBeTruthy();
    expect(getByTestId("settings-content")).toBeTruthy();
  });
});
