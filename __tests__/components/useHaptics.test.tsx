import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

const mockImpactAsync = jest.fn(() => Promise.resolve());
const mockNotificationAsync = jest.fn(() => Promise.resolve());

jest.mock("expo-haptics", () => ({
  impactAsync: mockImpactAsync,
  notificationAsync: mockNotificationAsync,
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  NotificationFeedbackType: { Success: "success", Warning: "warning" },
}));

// Imported after the mock so the hook binds to the stubbed module.
/* eslint-disable @typescript-eslint/no-require-imports */
const { useHaptics } = require("../../src/hooks/useHaptics");
const { createMemoryStorageService } = require("../../src/services/storage/StorageService");
const { StorageServiceProvider } = require("../../src/services/storage/StorageServiceProvider");
const { SettingsProvider, useSettings } = require("../../src/state/SettingsProvider");
const { defaultSettings } = require("../../src/services/storage/schemas");
/* eslint-enable @typescript-eslint/no-require-imports */

type Storage = ReturnType<typeof createMemoryStorageService>;

function wrapper(storage: Storage) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StorageServiceProvider service={storage}>
        <SettingsProvider>{children}</SettingsProvider>
      </StorageServiceProvider>
    );
  };
}

function useHarness() {
  return { haptics: useHaptics(), settings: useSettings() };
}

describe("useHaptics", () => {
  beforeEach(() => {
    mockImpactAsync.mockClear();
    mockNotificationAsync.mockClear();
  });

  it("maps the vocabulary to expo-haptics when enabled", async () => {
    const storage = createMemoryStorageService();
    const { result } = await renderHook(() => useHarness(), { wrapper: wrapper(storage) });
    result.current.haptics.selection();
    result.current.haptics.success();
    result.current.haptics.warning();
    result.current.haptics.timerUrgent();
    expect(mockImpactAsync).toHaveBeenCalledWith("light");
    expect(mockNotificationAsync).toHaveBeenCalledWith("success");
    expect(mockNotificationAsync).toHaveBeenCalledWith("warning");
    expect(mockImpactAsync).toHaveBeenCalledWith("medium");
  });

  it("produces no haptics when disabled", async () => {
    const storage = createMemoryStorageService();
    storage.seed(
      "blastdown/settings/v1",
      JSON.stringify({ ...defaultSettings(), hapticsEnabled: false }),
    );
    const { result } = await renderHook(() => useHarness(), { wrapper: wrapper(storage) });
    await waitFor(() => expect(result.current.settings.settings.hapticsEnabled).toBe(false));

    result.current.haptics.selection();
    result.current.haptics.timerUrgent();
    expect(mockImpactAsync).not.toHaveBeenCalled();
    expect(mockNotificationAsync).not.toHaveBeenCalled();
  });

  it("never throws when the native module rejects", async () => {
    mockImpactAsync.mockImplementationOnce(() => Promise.reject(new Error("no engine")));
    const storage = createMemoryStorageService();
    const { result } = await renderHook(() => useHarness(), { wrapper: wrapper(storage) });
    expect(() => result.current.haptics.selection()).not.toThrow();
  });
});
