import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AppState } from "react-native";
import type { ReactNode } from "react";

import { createInitialGameState } from "../../src/domain/game";
import type { GameState, GridCell } from "../../src/domain/gameTypes";
import { useGameController } from "../../src/hooks/useGameController";
import { useGamePersistence } from "../../src/hooks/useGamePersistence";
import {
  StorageServiceProvider,
  createMemoryStorageService,
  loadActiveRun,
  writeActiveRun,
  type MemoryStorageService,
} from "../../src/services/storage";

const NOW = 1_752_800_000_000;

function wrapper(storage: MemoryStorageService) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <StorageServiceProvider service={storage}>{children}</StorageServiceProvider>;
  };
}

function useHarness(initialState?: GameState) {
  const controller = useGameController({ seed: "harness", now: () => NOW, initialState });
  const persistence = useGamePersistence(controller, { now: () => NOW });
  return { controller, persistence };
}

/** A playing run one move from clearing row 0 (single at 0,0 finishes it). */
function playingRun(): GameState {
  const grid: GridCell[][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, (): GridCell => ({ kind: "empty" })),
  );
  return {
    ...createInitialGameState("saved-seed", NOW),
    status: "playing",
    score: 1200,
    grid,
    hand: [{ handId: "h-a", shapeId: "single", colorId: "amber" }],
  };
}

describe("active run persistence lifecycle", () => {
  it("restores a valid unfinished run on launch and offers Continue", async () => {
    const storage = createMemoryStorageService();
    const saved = playingRun();
    await writeActiveRun(storage, saved, 1, NOW);

    const { result } = await renderHook(() => useHarness(), { wrapper: wrapper(storage) });

    await waitFor(() => expect(result.current.persistence.hydrated).toBe(true));
    expect(result.current.controller.state.seed).toBe("saved-seed");
    expect(result.current.controller.state.score).toBe(1200);
    expect(result.current.persistence.hasActiveRun).toBe(true);
    expect(result.current.persistence.canContinue).toBe(true);
  });

  it("offers no Continue when there is no saved run", async () => {
    const storage = createMemoryStorageService();
    const { result } = await renderHook(() => useHarness(), { wrapper: wrapper(storage) });

    await waitFor(() => expect(result.current.persistence.hydrated).toBe(true));
    expect(result.current.persistence.hasActiveRun).toBe(false);
    expect(result.current.persistence.canContinue).toBe(false);
  });

  it("saves the run once started, and Restart stores the new run", async () => {
    const storage = createMemoryStorageService();
    const { result } = await renderHook(() => useHarness(), { wrapper: wrapper(storage) });
    await waitFor(() => expect(result.current.persistence.hydrated).toBe(true));

    await act(async () => {
      result.current.persistence.startNewRun();
    });
    await waitFor(async () => expect(await loadActiveRun(storage)).not.toBeNull());
    const firstSeed = (await loadActiveRun(storage))?.state.seed;
    expect(result.current.controller.state.status).toBe("playing");

    await act(async () => {
      result.current.controller.restart();
    });
    await waitFor(async () => {
      const saved = await loadActiveRun(storage);
      expect(saved?.state.seed).not.toBe(firstSeed);
    });
  });

  it("clears the saved run when the run reaches game over", async () => {
    // Restore a run one move from game over, then finish it.
    const grid: GridCell[][] = Array.from({ length: 8 }, () =>
      Array.from({ length: 8 }, (): GridCell => ({ kind: "normal", colorId: "cyan" })),
    );
    for (let row = 0; row < 8; row++) {
      grid[row][row] = { kind: "empty" };
      grid[row][(row + 1) % 8] = { kind: "empty" };
    }
    const nearOver: GameState = {
      ...createInitialGameState("over-seed", NOW),
      status: "playing",
      grid,
      hand: [
        { handId: "h-single", shapeId: "single", colorId: "amber" },
        { handId: "h-square", shapeId: "square2x2", colorId: "purple" },
      ],
    };
    const storage = createMemoryStorageService();
    await writeActiveRun(storage, nearOver, 1, NOW);

    const { result } = await renderHook(() => useHarness(), { wrapper: wrapper(storage) });
    await waitFor(() => expect(result.current.persistence.hasActiveRun).toBe(true));

    await act(async () => {
      result.current.controller.place("h-single", { row: 0, column: 0 });
    });

    await waitFor(() => expect(result.current.controller.state.status).toBe("gameOver"));
    await waitFor(async () => expect(await loadActiveRun(storage)).toBeNull());
  });

  it("End Run clears the saved run and deactivates the session", async () => {
    const storage = createMemoryStorageService();
    await writeActiveRun(storage, playingRun(), 1, NOW);
    const { result } = await renderHook(() => useHarness(), { wrapper: wrapper(storage) });
    await waitFor(() => expect(result.current.persistence.hasActiveRun).toBe(true));

    await act(async () => {
      result.current.persistence.clearActiveRun();
    });
    await waitFor(async () => expect(await loadActiveRun(storage)).toBeNull());
    expect(result.current.persistence.hasActiveRun).toBe(false);
  });

  it("flushes the run when the app backgrounds", async () => {
    const handlers: ((s: string) => void)[] = [];
    const spy = jest.spyOn(AppState, "addEventListener").mockImplementation((_event, handler) => {
      handlers.push(handler as (s: string) => void);
      return { remove: jest.fn() } as never;
    });
    try {
      const storage = createMemoryStorageService();
      await writeActiveRun(storage, playingRun(), 1, NOW);
      const { result } = await renderHook(() => useHarness(), { wrapper: wrapper(storage) });
      await waitFor(() => expect(result.current.persistence.hasActiveRun).toBe(true));
      await storage.removeItem("blastdown/active-run/v1");

      await act(async () => {
        handlers.forEach((handler) => handler("background"));
      });
      await waitFor(async () => expect(await loadActiveRun(storage)).not.toBeNull());
    } finally {
      spy.mockRestore();
    }
  });
});
