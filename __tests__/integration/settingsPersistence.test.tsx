import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { createMemoryStorageService } from "../../src/services/storage/StorageService";
import { StorageServiceProvider } from "../../src/services/storage/StorageServiceProvider";
import type { MemoryStorageService } from "../../src/services/storage/StorageService";
import { loadSettings } from "../../src/services/storage/settingsStorage";
import { loadProfile } from "../../src/services/storage/progressStorage";
import { SettingsProvider, useSettings } from "../../src/state/SettingsProvider";
import { ProfileProvider, useProfile } from "../../src/state/ProfileProvider";

const NOW = 1_752_800_000_000;

function settingsWrapper(storage: MemoryStorageService) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StorageServiceProvider service={storage}>
        <SettingsProvider>{children}</SettingsProvider>
      </StorageServiceProvider>
    );
  };
}

function profileWrapper(storage: MemoryStorageService) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StorageServiceProvider service={storage}>
        <ProfileProvider now={() => NOW}>{children}</ProfileProvider>
      </StorageServiceProvider>
    );
  };
}

describe("settings persistence", () => {
  it("writes changes to storage so they survive a restart", async () => {
    const storage = createMemoryStorageService();
    const { result } = await renderHook(() => useSettings(), { wrapper: settingsWrapper(storage) });
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await act(async () => {
      result.current.updateSettings({ soundEnabled: false, hapticsEnabled: false });
    });
    await waitFor(() => expect(result.current.settings.soundEnabled).toBe(false));

    // A fresh provider on relaunch reads exactly this stored value.
    const stored = await loadSettings(storage);
    expect(stored.soundEnabled).toBe(false);
    expect(stored.hapticsEnabled).toBe(false);
    expect(stored.musicEnabled).toBe(true);
  });

  it("stores a reduced-motion override", async () => {
    const storage = createMemoryStorageService();
    const { result } = await renderHook(() => useSettings(), { wrapper: settingsWrapper(storage) });
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await act(async () => {
      result.current.updateSettings({ reducedMotionOverride: true });
    });
    await waitFor(() => expect(result.current.settings.reducedMotionOverride).toBe(true));
    expect((await loadSettings(storage)).reducedMotionOverride).toBe(true);
  });
});

describe("profile persistence", () => {
  it("persists profile updates to storage", async () => {
    const storage = createMemoryStorageService();
    const { result } = await renderHook(() => useProfile(), { wrapper: profileWrapper(storage) });
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await act(async () => {
      result.current.updateProfile((p) => ({ ...p, bestScore: 4200, bolts: 33 }));
    });
    await waitFor(() => expect(result.current.profile.bestScore).toBe(4200));

    const stored = await loadProfile(storage, NOW);
    expect(stored.bestScore).toBe(4200);
    expect(stored.bolts).toBe(33);
  });

  it("does not write the default profile before load completes", async () => {
    // Nothing stored + no update => storage stays empty (no default clobber).
    const storage = createMemoryStorageService();
    const { result } = await renderHook(() => useProfile(), { wrapper: profileWrapper(storage) });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(await storage.getItem("blastdown/profile/v1")).toBeNull();
  });
});
