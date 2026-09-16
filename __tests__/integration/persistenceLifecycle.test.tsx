import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useEffect, useRef, type ReactNode } from "react";

import { captureAppStateHandlers } from "../../test-utils/appState";

import { createInitialGameState } from "../../src/domain/game";
import type { GameState, GridCell } from "../../src/domain/gameTypes";
import { useGameController, type GameController } from "../../src/hooks/useGameController";
import { useGamePersistence } from "../../src/hooks/useGamePersistence";
import { createMemoryErrorReporter } from "../../src/services/diagnostics/MemoryErrorReporter";
import {
  resetActiveErrorReporter,
  setActiveErrorReporter,
} from "../../src/services/diagnostics/reportError";
import {
  STORAGE_KEYS,
  StorageServiceProvider,
  createMemoryStorageService,
  loadActiveRun,
  type StorageService,
  writeActiveRun,
} from "../../src/services/storage";

const NOW = 1_752_800_000_000;

function wrapper(storage: StorageService) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <StorageServiceProvider service={storage}>{children}</StorageServiceProvider>;
  };
}

function deferred<T>() {
  let resolve: ((value: T) => void) | undefined;
  let reject: ((reason?: unknown) => void) | undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return {
    promise,
    resolve: (value: T) => resolve?.(value),
    reject: (reason?: unknown) => reject?.(reason),
  };
}

// The controller's production seed factory is `run-${Date.now()}`, so two runs
// created inside the same millisecond share a seed — which a test can hit but a
// player cannot. Restarts here use the controller's own injectable seed factory
// with a counter, so "Restart stores the NEW run" is asserted without depending
// on the wall clock ticking between two synchronous calls.
let restartCounter = 0;

function useHarness(initialState?: GameState) {
  const controller = useGameController({
    seed: "harness",
    now: () => NOW,
    nextSeed: () => `harness-restart-${++restartCounter}`,
    initialState,
  });
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

function controllerStub(seed: string): GameController {
  return {
    state: createInitialGameState(seed, NOW),
    sessionGeneration: 0,
    selectedHandId: null,
    lastEvents: [],
    selectPiece: jest.fn(),
    clearSelection: jest.fn(),
    previewAt: jest.fn(() => null),
    placeAt: jest.fn(() => false),
    previewFor: jest.fn(() => null),
    createPlacementIntent: jest.fn(() => null),
    place: jest.fn(() => false),
    activateFreeze: jest.fn(() => false),
    defuse: jest.fn(() => false),
    revive: jest.fn(() => false),
    hydrate: jest.fn(),
    restart: jest.fn(),
  };
}

describe("active run persistence lifecycle", () => {
  afterEach(() => resetActiveErrorReporter());

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
    const { handlers, restore } = captureAppStateHandlers();
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
      restore();
    }
  });

  it("does not let delayed hydration overwrite a new run that supersedes it", async () => {
    const memory = createMemoryStorageService();
    await writeActiveRun(memory, playingRun(), 1, NOW);
    const savedRaw = await memory.getItem(STORAGE_KEYS.activeRun);
    const activeRunRead = deferred<string | null>();
    const storage: StorageService = {
      ...memory,
      getItem: (key) =>
        key === STORAGE_KEYS.activeRun ? activeRunRead.promise : memory.getItem(key),
    };
    const { result } = await renderHook(() => useHarness(), { wrapper: wrapper(storage) });

    expect(result.current.persistence.hydrated).toBe(false);
    expect(result.current.persistence.hydrationState).toBe("pending");
    await act(async () => {
      result.current.persistence.startNewRun();
    });
    const newRunSeed = result.current.controller.state.seed;
    expect(newRunSeed).not.toBe("saved-seed");

    await act(async () => {
      activeRunRead.resolve(savedRaw);
      await activeRunRead.promise;
    });

    await waitFor(() => expect(result.current.persistence.hydrated).toBe(true));
    expect(result.current.persistence.hydrationState).toBe("hydrated");
    expect(result.current.controller.state.seed).toBe(newRunSeed);
    expect(result.current.persistence.hasActiveRun).toBe(true);
  });

  it("finishes hydration, reports once, and can start fresh after a read rejection", async () => {
    const reporter = createMemoryErrorReporter();
    setActiveErrorReporter(reporter);
    const memory = createMemoryStorageService();
    const storage: StorageService = {
      ...memory,
      getItem: async (key) => {
        if (key === STORAGE_KEYS.activeRun) {
          throw new Error("active run read failed");
        }
        return memory.getItem(key);
      },
    };
    const { result } = await renderHook(() => useHarness(), { wrapper: wrapper(storage) });

    await waitFor(() => expect(result.current.persistence.hydrated).toBe(true));
    expect(result.current.persistence.hydrationState).toBe("hydrated");
    expect(result.current.persistence.canContinue).toBe(false);
    expect(reporter.bySurface("persistence")).toEqual([
      expect.objectContaining({
        surface: "persistence",
        message: "active run read failed",
        context: { operation: "load_active_run" },
      }),
    ]);

    await act(async () => {
      result.current.persistence.startNewRun();
    });
    expect(result.current.controller.state.status).toBe("playing");
    expect(result.current.persistence.hasActiveRun).toBe(true);
  });

  it("cleans a corrupt run without blocking hydration or unrelated storage", async () => {
    const reporter = createMemoryErrorReporter();
    setActiveErrorReporter(reporter);
    const profile = '{"bestScore":9876}';
    const settings = '{"musicEnabled":false}';
    const storage = createMemoryStorageService({
      [STORAGE_KEYS.activeRun]: "corrupt-json{",
      [STORAGE_KEYS.profile]: profile,
      [STORAGE_KEYS.settings]: settings,
    });

    const { result } = await renderHook(() => useHarness(), { wrapper: wrapper(storage) });

    await waitFor(() => expect(result.current.persistence.hydrated).toBe(true));
    expect(result.current.persistence.canContinue).toBe(false);
    expect(storage.store.has(STORAGE_KEYS.activeRun)).toBe(false);
    expect(storage.store.get(STORAGE_KEYS.profile)).toBe(profile);
    expect(storage.store.get(STORAGE_KEYS.settings)).toBe(settings);
    expect(reporter.bySurface("persistence")).toHaveLength(1);

    await act(async () => {
      result.current.persistence.startNewRun();
    });
    expect(result.current.persistence.hasActiveRun).toBe(true);
  });

  it("finishes hydration when corrupt-run cleanup fails and reports both failures once", async () => {
    const reporter = createMemoryErrorReporter();
    setActiveErrorReporter(reporter);
    const memory = createMemoryStorageService({
      [STORAGE_KEYS.activeRun]: "corrupt-json{",
    });
    const storage: StorageService = {
      ...memory,
      removeItem: async (key) => {
        if (key === STORAGE_KEYS.activeRun) {
          throw new Error("cleanup failed");
        }
        await memory.removeItem(key);
      },
    };

    const { result } = await renderHook(() => useHarness(), { wrapper: wrapper(storage) });

    await waitFor(() => expect(result.current.persistence.hydrated).toBe(true));
    expect(result.current.persistence.canContinue).toBe(false);
    expect(reporter.bySurface("persistence")).toEqual([
      expect.objectContaining({
        message: "Invalid active-run payload",
        context: { operation: "load_active_run", reason: "invalid_json" },
      }),
      expect.objectContaining({
        message: "cleanup failed",
        context: { operation: "cleanup_active_run" },
      }),
    ]);
  });

  it("exposes a critical flush that waits for the latest completed turn", async () => {
    const saved = playingRun();
    const memory = createMemoryStorageService();
    await writeActiveRun(memory, saved, 1, NOW);
    let blockWrites = false;
    let releaseWrite: (() => void) | undefined;
    let markWriteStarted: (() => void) | undefined;
    const writeStarted = new Promise<void>((resolve) => {
      markWriteStarted = resolve;
    });
    const writeGate = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    const storage: StorageService = {
      ...memory,
      setItem: async (key, value) => {
        if (key === STORAGE_KEYS.activeRun && blockWrites) {
          markWriteStarted?.();
          await writeGate;
        }
        await memory.setItem(key, value);
      },
    };
    const { result } = await renderHook(() => useHarness(), { wrapper: wrapper(storage) });
    await waitFor(() => expect(result.current.persistence.hasActiveRun).toBe(true));
    await waitFor(async () => expect((await loadActiveRun(memory))?.state.score).toBe(1200));

    blockWrites = true;
    await act(async () => {
      result.current.controller.place("h-a", { row: 0, column: 0 });
    });
    const authoritativeState = result.current.controller.state;
    let flushResolved = false;
    let flush: Promise<void> | undefined;
    await act(async () => {
      flush = result.current.persistence.flushActiveRun().then(() => {
        flushResolved = true;
      });
      await writeStarted;
    });
    expect(flushResolved).toBe(false);

    await act(async () => {
      releaseWrite?.();
      await flush;
    });

    expect((await loadActiveRun(memory))?.state).toEqual(authoritativeState);
  });

  it("ignores stale hydration completion after replacing the session controller", async () => {
    const memory = createMemoryStorageService();
    await writeActiveRun(memory, playingRun(), 1, NOW);
    const savedRaw = await memory.getItem(STORAGE_KEYS.activeRun);
    const oldRead = deferred<string | null>();
    let activeRunReads = 0;
    const storage: StorageService = {
      ...memory,
      getItem: (key) => {
        if (key !== STORAGE_KEYS.activeRun) {
          return memory.getItem(key);
        }
        activeRunReads += 1;
        return activeRunReads === 1 ? oldRead.promise : Promise.resolve(null);
      },
    };
    const originalController = controllerStub("original-controller");
    const replacementController = controllerStub("replacement-controller");
    const session = await renderHook(
      ({ controller }: { controller: GameController }) =>
        useGamePersistence(controller, { now: () => NOW }),
      {
        initialProps: { controller: originalController },
        wrapper: wrapper(storage),
      },
    );

    await act(async () => {
      session.rerender({ controller: replacementController });
      await Promise.resolve();
    });
    await waitFor(() => expect(session.result.current.hydrated).toBe(true));

    await act(async () => {
      oldRead.resolve(savedRaw);
      await oldRead.promise;
      await Promise.resolve();
    });

    expect(originalController.hydrate).not.toHaveBeenCalled();
    expect(replacementController.hydrate).not.toHaveBeenCalled();
    expect(session.result.current.hasActiveRun).toBe(false);
  });

  it("completes hydration exactly once", async () => {
    const onHydrationComplete = jest.fn();
    const storage = createMemoryStorageService();

    function useObservedHarness() {
      const harness = useHarness();
      const wasHydrated = useRef(false);
      useEffect(() => {
        if (!wasHydrated.current && harness.persistence.hydrated) {
          onHydrationComplete();
        }
        wasHydrated.current = harness.persistence.hydrated;
      }, [harness.persistence.hydrated]);
      return harness;
    }

    const observed = await renderHook(() => useObservedHarness(), { wrapper: wrapper(storage) });
    await waitFor(() => expect(observed.result.current.persistence.hydrated).toBe(true));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onHydrationComplete).toHaveBeenCalledTimes(1);
  });
});
