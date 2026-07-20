import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { createMemoryStorageService } from "../../src/services/storage/StorageService";
import { StorageServiceProvider } from "../../src/services/storage/StorageServiceProvider";
import type { MemoryStorageService } from "../../src/services/storage/StorageService";
import { GameSessionProvider, useGameSession } from "../../src/state/GameSessionProvider";
import { ProfileProvider, useProfile } from "../../src/state/ProfileProvider";

const NOW = 1_752_800_000_000;

function wrapper(storage: MemoryStorageService) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StorageServiceProvider service={storage}>
        <ProfileProvider now={() => NOW}>
          <GameSessionProvider>{children}</GameSessionProvider>
        </ProfileProvider>
      </StorageServiceProvider>
    );
  };
}

function useHarness() {
  return { session: useGameSession(), profile: useProfile() };
}

describe("run settlement idempotency", () => {
  it("settles a run exactly once even when settleCurrentRun is called repeatedly", async () => {
    const storage = createMemoryStorageService();
    const { result } = await renderHook(() => useHarness(), { wrapper: wrapper(storage) });
    await waitFor(() => expect(result.current.profile.loaded).toBe(true));
    await waitFor(() => expect(result.current.session.hydrated).toBe(true));

    // Simulate Results mounting, then remount / Back re-triggering settlement.
    await act(async () => {
      result.current.session.settleCurrentRun();
      result.current.session.settleCurrentRun();
      result.current.session.settleCurrentRun();
    });

    await waitFor(() => expect(result.current.profile.profile.totalRuns).toBe(1));
    expect(result.current.profile.profile.totalRuns).toBe(1);
  });

  it("settles a new run separately after Play Again", async () => {
    const storage = createMemoryStorageService();
    const { result } = await renderHook(() => useHarness(), { wrapper: wrapper(storage) });
    await waitFor(() => expect(result.current.profile.loaded).toBe(true));

    await act(async () => {
      result.current.session.settleCurrentRun();
    });
    await waitFor(() => expect(result.current.profile.profile.totalRuns).toBe(1));

    // A fresh run has a new id (seed + startedAt) and settles on its own.
    await act(async () => {
      result.current.session.startNewRun();
    });
    await act(async () => {
      result.current.session.settleCurrentRun();
    });
    await waitFor(() => expect(result.current.profile.profile.totalRuns).toBe(2));
  });
});
