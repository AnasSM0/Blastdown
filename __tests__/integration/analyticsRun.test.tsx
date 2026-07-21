import { act, render, renderHook, userEvent, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { GameScreenContent } from "../../app/game";
import { createInitialGameState } from "../../src/domain/game";
import type { GameState, GridCell } from "../../src/domain/gameTypes";
import { createMockAdService } from "../../src/services/ads/MockAdService";
import { AnalyticsServiceProvider } from "../../src/services/analytics/AnalyticsServiceProvider";
import { createMemoryAnalyticsService } from "../../src/services/analytics/MemoryAnalyticsService";
import type { MemoryAnalyticsService } from "../../src/services/analytics/MemoryAnalyticsService";
import { createMemoryStorageService } from "../../src/services/storage/StorageService";
import { StorageServiceProvider } from "../../src/services/storage/StorageServiceProvider";
import type { MemoryStorageService } from "../../src/services/storage/StorageService";
import { GameSessionProvider, useGameSession } from "../../src/state/GameSessionProvider";
import { ProfileProvider, useProfile } from "../../src/state/ProfileProvider";

const NOW = 1_752_800_000_000;

function makeEmptyGrid(size: number): GridCell[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, (): GridCell => ({ kind: "empty" })),
  );
}

function sessionWrapper(storage: MemoryStorageService, analytics: MemoryAnalyticsService) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StorageServiceProvider service={storage}>
        <AnalyticsServiceProvider service={analytics}>
          <ProfileProvider now={() => NOW}>
            <GameSessionProvider>{children}</GameSessionProvider>
          </ProfileProvider>
        </AnalyticsServiceProvider>
      </StorageServiceProvider>
    );
  };
}

function useHarness() {
  return { session: useGameSession(), profile: useProfile() };
}

describe("run lifecycle analytics", () => {
  it("logs run_end exactly once across repeated settlement (remount / Back)", async () => {
    const storage = createMemoryStorageService();
    const analytics = createMemoryAnalyticsService();
    const { result } = await renderHook(() => useHarness(), {
      wrapper: sessionWrapper(storage, analytics),
    });
    await waitFor(() => expect(result.current.profile.loaded).toBe(true));
    await waitFor(() => expect(result.current.session.hydrated).toBe(true));

    await act(async () => {
      result.current.session.settleCurrentRun();
      result.current.session.settleCurrentRun();
      result.current.session.settleCurrentRun();
    });

    expect(analytics.count("run_end")).toBe(1);
    const runEnd = analytics.byName("run_end")[0];
    expect(runEnd).toMatchObject({ name: "run_end" });
    // Aggregate-only payload: no seed / grid leaked.
    expect(Object.keys(runEnd)).not.toContain("seed");
  });

  it("logs run_start on a new run and run_end again after it settles", async () => {
    const storage = createMemoryStorageService();
    const analytics = createMemoryAnalyticsService();
    const { result } = await renderHook(() => useHarness(), {
      wrapper: sessionWrapper(storage, analytics),
    });
    await waitFor(() => expect(result.current.profile.loaded).toBe(true));

    await act(async () => {
      result.current.session.settleCurrentRun();
    });
    await act(async () => {
      result.current.session.startNewRun();
    });
    await act(async () => {
      result.current.session.settleCurrentRun();
    });

    expect(analytics.count("run_start")).toBe(1);
    expect(analytics.count("run_end")).toBe(2);
  });
});

describe("gameplay event analytics", () => {
  const options = { seed: "analytics-seed", now: () => NOW };

  it("logs piece_selected once and piece_placed once for a placed turn", async () => {
    const analytics = createMemoryAnalyticsService();
    const user = userEvent.setup();
    const result = await render(
      <GameScreenContent controllerOptions={options} boardSize={328} analytics={analytics} />,
    );

    const trayPieces = result.getAllByTestId(/^tray-piece-/);
    await user.press(trayPieces[0]);
    await user.press(result.getByTestId("cell-0-0"));

    expect(analytics.count("piece_selected")).toBe(1);
    expect(analytics.count("piece_placed")).toBe(1);
  });

  it("logs piece_rejected on an invalid placement without a piece_placed", async () => {
    const grid = makeEmptyGrid(8);
    grid[0][0] = { kind: "normal", colorId: "cyan" };
    const initialState: GameState = {
      ...createInitialGameState("analytics-reject", NOW),
      grid,
      hand: [{ handId: "h-square", shapeId: "square2x2", colorId: "purple" }],
    };
    const analytics = createMemoryAnalyticsService();
    const user = userEvent.setup();
    const result = await render(
      <GameScreenContent
        controllerOptions={{ ...options, initialState }}
        boardSize={328}
        analytics={analytics}
      />,
    );

    await user.press(result.getByTestId("tray-piece-h-square"));
    await user.press(result.getByTestId("cell-0-0"));

    expect(analytics.count("piece_rejected")).toBe(1);
    expect(analytics.count("piece_placed")).toBe(0);
  });

  it("keeps gameplay working when the analytics backend throws on every event", async () => {
    const throwing = createMemoryAnalyticsService({ throwOnTrack: true });
    const user = userEvent.setup();
    const result = await render(
      <GameScreenContent controllerOptions={options} boardSize={328} analytics={throwing} />,
    );

    const trayPieces = result.getAllByTestId(/^tray-piece-/);
    const firstHandId = trayPieces[0].props.testID.replace("tray-piece-", "");
    await user.press(trayPieces[0]);
    await user.press(result.getByTestId("cell-0-0"));

    // The turn still resolved: the piece left the tray despite analytics failing.
    expect(result.queryByTestId(`tray-piece-${firstHandId}`)).toBeNull();
  });
});

describe("reward instrumentation analytics", () => {
  function runWithTimer(): GameState {
    const grid = makeEmptyGrid(8);
    grid[0][0] = { kind: "timed", pieceInstanceId: "t1", colorId: "cyan" };
    grid[0][1] = { kind: "timed", pieceInstanceId: "t1", colorId: "cyan" };
    return {
      ...createInitialGameState("reward-analytics", NOW),
      status: "playing",
      grid,
      activeTimers: {
        t1: { id: "t1", shapeId: "domino", remainingTurns: 2, placedOnTurn: 1, colorId: "cyan" },
      },
      hand: [{ handId: "h-spare", shapeId: "single", colorId: "amber" }],
    };
  }

  it("logs freeze_offer and freeze_result once for an earned freeze", async () => {
    const analytics = createMemoryAnalyticsService();
    const ads = createMockAdService({ rewarded: { rewarded_freeze: "earned" } });
    const result = await render(
      <GameScreenContent
        controllerOptions={{
          seed: "reward-analytics",
          now: () => NOW,
          initialState: runWithTimer(),
        }}
        boardSize={328}
        adService={ads}
        analytics={analytics}
      />,
    );

    const user = userEvent.setup();
    await user.press(result.getByTestId("freeze-button"));

    await waitFor(() => expect(analytics.count("freeze_result")).toBe(1));
    expect(analytics.count("freeze_offer")).toBe(1);
    expect(analytics.byName("freeze_result")[0]).toEqual({
      name: "freeze_result",
      result: "earned",
    });
  });
});
