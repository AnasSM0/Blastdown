import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { useEffectiveReducedMotion } from "../../src/hooks/useEffectiveReducedMotion";
import { createMemoryStorageService } from "../../src/services/storage/StorageService";
import { StorageServiceProvider } from "../../src/services/storage/StorageServiceProvider";
import type { MemoryStorageService } from "../../src/services/storage/StorageService";
import { defaultSettings } from "../../src/services/storage/schemas";
import { SettingsProvider, useSettings } from "../../src/state/SettingsProvider";

const mockOs = { value: false };
jest.mock("../../src/hooks/useReducedMotion", () => ({
  useReducedMotion: () => mockOs.value,
}));

function wrapper(storage: MemoryStorageService) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StorageServiceProvider service={storage}>
        <SettingsProvider>{children}</SettingsProvider>
      </StorageServiceProvider>
    );
  };
}

function seed(override: boolean | null): MemoryStorageService {
  const storage = createMemoryStorageService();
  storage.seed(
    "blastdown/settings/v1",
    JSON.stringify({ ...defaultSettings(), reducedMotionOverride: override }),
  );
  return storage;
}

function useHarness() {
  return { effective: useEffectiveReducedMotion(), settings: useSettings() };
}

describe("useEffectiveReducedMotion", () => {
  afterEach(() => {
    mockOs.value = false;
  });

  it("follows the OS setting when the override is null", async () => {
    mockOs.value = true;
    const { result } = await renderHook(() => useHarness(), { wrapper: wrapper(seed(null)) });
    await waitFor(() => expect(result.current.settings.loaded).toBe(true));
    expect(result.current.effective).toBe(true);
  });

  it("forces reduced motion when the override is true, regardless of OS", async () => {
    mockOs.value = false;
    const { result } = await renderHook(() => useHarness(), { wrapper: wrapper(seed(true)) });
    await waitFor(() => expect(result.current.settings.settings.reducedMotionOverride).toBe(true));
    expect(result.current.effective).toBe(true);
  });

  it("uses normal motion when the override is false, even if OS reduces", async () => {
    mockOs.value = true;
    const { result } = await renderHook(() => useHarness(), { wrapper: wrapper(seed(false)) });
    await waitFor(() => expect(result.current.settings.settings.reducedMotionOverride).toBe(false));
    expect(result.current.effective).toBe(false);
  });
});
