import { act, renderHook } from "@testing-library/react-native";

import { useGameController } from "../../src/hooks/useGameController";
import { createInitialGameState } from "../../src/domain/game";
import type { GameState } from "../../src/domain/gameTypes";

const NOW = 1_752_800_000_000;

function options(seed = "controller-seed") {
  let restartCount = 0;
  return {
    seed,
    now: () => NOW,
    nextSeed: () => `restart-${(restartCount += 1)}`,
  };
}

describe("useGameController", () => {
  it("creates a real initial game state from the seed", async () => {
    const { result } = await renderHook(() => useGameController(options()));
    expect(result.current.state.seed).toBe("controller-seed");
    expect(result.current.state.hand).toHaveLength(3);
    expect(result.current.state.status).toBe("playing");
    expect(result.current.selectedHandId).toBeNull();
  });

  it("selects and toggles a hand piece", async () => {
    const { result } = await renderHook(() => useGameController(options()));
    const handId = result.current.state.hand[0].handId;

    await act(() => result.current.selectPiece(handId));
    expect(result.current.selectedHandId).toBe(handId);

    await act(() => result.current.selectPiece(handId));
    expect(result.current.selectedHandId).toBeNull();
  });

  it("returns no preview without a selection, a real preview with one", async () => {
    const { result } = await renderHook(() => useGameController(options()));
    expect(result.current.previewAt({ row: 0, column: 0 })).toBeNull();

    await act(() => result.current.selectPiece(result.current.state.hand[0].handId));
    const preview = result.current.previewAt({ row: 0, column: 0 });
    expect(preview).not.toBeNull();
    expect(preview?.valid).toBe(true);
    expect(preview?.cells.length).toBeGreaterThan(0);
  });

  it("places a piece through the domain engine and clears the selection", async () => {
    const { result } = await renderHook(() => useGameController(options()));
    const handId = result.current.state.hand[0].handId;

    await act(() => result.current.selectPiece(handId));
    let accepted = false;
    await act(() => {
      accepted = result.current.placeAt({ row: 0, column: 0 });
    });

    expect(accepted).toBe(true);
    expect(result.current.state.turn).toBe(1);
    expect(result.current.state.piecesPlaced).toBe(1);
    expect(result.current.selectedHandId).toBeNull();
    expect(result.current.lastEvents.some((event) => event.type === "piecePlaced")).toBe(true);
  });

  it("rejects an invalid placement without mutating state", async () => {
    const { result } = await renderHook(() => useGameController(options()));
    const stateBefore = result.current.state;
    const handId = stateBefore.hand[0].handId;

    await act(() => result.current.selectPiece(handId));
    let accepted = true;
    await act(() => {
      accepted = result.current.placeAt({ row: 99, column: 99 });
    });

    expect(accepted).toBe(false);
    expect(result.current.state).toBe(stateBefore);
    // Selection survives a rejected attempt so the player can retry.
    expect(result.current.selectedHandId).toBe(handId);
  });

  it("returns false from placeAt when nothing is selected", async () => {
    const { result } = await renderHook(() => useGameController(options()));
    let accepted = true;
    await act(() => {
      accepted = result.current.placeAt({ row: 0, column: 0 });
    });
    expect(accepted).toBe(false);
    expect(result.current.state.turn).toBe(0);
  });

  it("previewFor returns a preview for an explicit hand piece without a selection", async () => {
    const { result } = await renderHook(() => useGameController(options()));
    const handId = result.current.state.hand[0].handId;

    expect(result.current.selectedHandId).toBeNull();
    const preview = result.current.previewFor(handId, { row: 0, column: 0 });
    expect(preview).not.toBeNull();
    expect(preview?.cells.length).toBeGreaterThan(0);
    // Explicit preview does not create a selection (drag path).
    expect(result.current.selectedHandId).toBeNull();
  });

  it("place drops an explicit hand piece exactly once and rejects a duplicate", async () => {
    const { result } = await renderHook(() => useGameController(options()));
    const handId = result.current.state.hand[0].handId;

    let first = false;
    await act(() => {
      first = result.current.place(handId, { row: 0, column: 0 });
    });
    expect(first).toBe(true);
    expect(result.current.state.piecesPlaced).toBe(1);

    const afterFirst = result.current.state;
    // A duplicated gesture-end with the same (now consumed) handId is a no-op.
    let second = true;
    await act(() => {
      second = result.current.place(handId, { row: 2, column: 2 });
    });
    expect(second).toBe(false);
    expect(result.current.state).toBe(afterFirst);
  });

  it("rejects a synchronous duplicate before React rerenders", async () => {
    const { result } = await renderHook(() => useGameController(options()));
    const handId = result.current.state.hand[0].handId;

    let first = false;
    let duplicate = true;
    await act(() => {
      first = result.current.place(handId, { row: 0, column: 0 });
      duplicate = result.current.place(handId, { row: 0, column: 0 });
    });

    expect(first).toBe(true);
    expect(duplicate).toBe(false);
    expect(result.current.state.turn).toBe(1);
    expect(result.current.state.piecesPlaced).toBe(1);
  });

  it("rejects a duplicated gesture intent and stale hand identity", async () => {
    const { result } = await renderHook(() => useGameController(options()));
    const handId = result.current.state.hand[0].handId;
    const intent = result.current.createPlacementIntent(handId);
    expect(intent).not.toBeNull();

    let first = false;
    let duplicate = true;
    await act(() => {
      first = result.current.place(intent!, { row: 0, column: 0 });
      duplicate = result.current.place(intent!, { row: 2, column: 2 });
    });

    expect(first).toBe(true);
    expect(duplicate).toBe(false);
    expect(result.current.state.turn).toBe(1);
    expect(result.current.state.hand.some((piece) => piece.handId === handId)).toBe(false);
  });

  it("rejects a previous-session gesture after restart", async () => {
    const { result } = await renderHook(() => useGameController(options()));
    const intent = result.current.createPlacementIntent(result.current.state.hand[0].handId);
    expect(intent).not.toBeNull();

    let staleAccepted = true;
    let freshAccepted = false;
    await act(() => {
      result.current.restart();
      staleAccepted = result.current.place(intent!, { row: 0, column: 0 });
      // Restart intentionally reuses slot-shaped hand ids; generation is what
      // distinguishes this fresh logical piece from the stale gesture above.
      const freshIntent = result.current.createPlacementIntent(intent!.handId);
      freshAccepted =
        freshIntent !== null && result.current.place(freshIntent, { row: 0, column: 0 });
    });

    expect(staleAccepted).toBe(false);
    expect(freshAccepted).toBe(true);
    expect(result.current.state.seed).toBe("restart-1");
    expect(result.current.state.turn).toBe(1);
    expect(result.current.state.piecesPlaced).toBe(1);
  });

  it("invalidates a captured prediction after a turn or session change", async () => {
    const { result } = await renderHook(() => useGameController(options()));
    const firstId = result.current.state.hand[0].handId;
    const secondId = result.current.state.hand[1].handId;
    const firstIntent = result.current.createPlacementIntent(firstId);
    const secondIntent = result.current.createPlacementIntent(secondId);
    expect(firstIntent).not.toBeNull();
    expect(secondIntent).not.toBeNull();
    expect(result.current.previewFor(secondIntent!, { row: 2, column: 2 })).not.toBeNull();

    await act(() => result.current.place(firstIntent!, { row: 0, column: 0 }));
    expect(result.current.previewFor(secondIntent!, { row: 2, column: 2 })).toBeNull();

    const beforeRestart = result.current.createPlacementIntent(secondId);
    expect(beforeRestart).not.toBeNull();
    await act(() => result.current.restart());
    expect(result.current.previewFor(beforeRestart!, { row: 2, column: 2 })).toBeNull();
  });

  it("accepts the next legitimate placement synchronously with no delay", async () => {
    const initialState: GameState = {
      ...createInitialGameState("fast-follow", NOW),
      hand: [
        { handId: "first", shapeId: "single", colorId: "cyan" },
        { handId: "second", shapeId: "single", colorId: "purple" },
      ],
    };
    const { result } = await renderHook(() => useGameController({ ...options(), initialState }));

    let first = false;
    let second = false;
    await act(() => {
      first = result.current.place("first", { row: 0, column: 0 });
      const nextIntent = result.current.createPlacementIntent("second");
      second = nextIntent !== null && result.current.place(nextIntent, { row: 2, column: 2 });
    });

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(result.current.state.turn).toBe(2);
    expect(result.current.state.piecesPlaced).toBe(2);
  });

  it("place rejects an out-of-bounds origin without mutating state", async () => {
    const { result } = await renderHook(() => useGameController(options()));
    const handId = result.current.state.hand[0].handId;
    const before = result.current.state;

    let accepted = true;
    await act(() => {
      accepted = result.current.place(handId, { row: 99, column: 99 });
    });
    expect(accepted).toBe(false);
    expect(result.current.state).toBe(before);
  });

  it("restart creates a fresh seeded run and resets selection and events", async () => {
    const { result } = await renderHook(() => useGameController(options()));
    const handId = result.current.state.hand[0].handId;
    await act(() => result.current.selectPiece(handId));
    await act(() => {
      result.current.placeAt({ row: 0, column: 0 });
    });
    expect(result.current.state.turn).toBe(1);

    await act(() => result.current.restart());
    expect(result.current.state.turn).toBe(0);
    expect(result.current.state.seed).toBe("restart-1");
    expect(result.current.selectedHandId).toBeNull();
    expect(result.current.lastEvents).toEqual([]);
  });
});

describe("useGameController lifecycle actions", () => {
  const base = () => createInitialGameState("lifecycle-seed", NOW);

  function withTimer(): GameState {
    return {
      ...base(),
      status: "playing",
      activeTimers: {
        t1: { id: "t1", shapeId: "single", remainingTurns: 3, placedOnTurn: 1, colorId: "cyan" },
      },
    };
  }

  it("activateFreeze mutates via the domain and reports success once", async () => {
    const initialState = withTimer();
    const { result } = await renderHook(() => useGameController({ ...options(), initialState }));

    let ok = false;
    await act(() => {
      ok = result.current.activateFreeze();
    });
    expect(ok).toBe(true);
    expect(result.current.state.freezeTurnsRemaining).toBe(2);
    expect(result.current.lastEvents.some((e) => e.type === "freezeActivated")).toBe(true);

    // Cannot stack: already active -> domain rejects, no mutation.
    let second = true;
    await act(() => {
      second = result.current.activateFreeze();
    });
    expect(second).toBe(false);
    expect(result.current.state.rewardedFreezeUses).toBe(1);
  });

  it("defuse targets the domain-selected piece and returns false with no timers", async () => {
    const { result } = await renderHook(() =>
      useGameController({ ...options(), initialState: withTimer() }),
    );
    let ok = false;
    await act(() => {
      ok = result.current.defuse();
    });
    expect(ok).toBe(true);
    expect(result.current.state.activeTimers.t1).toBeUndefined();
    expect(result.current.state.piecesDefused).toBe(1);

    let again = true;
    await act(() => {
      again = result.current.defuse();
    });
    expect(again).toBe(false);
  });

  it("revive works once from game over then rejects", async () => {
    const over: GameState = { ...base(), status: "gameOver", score: 500 };
    const { result } = await renderHook(() =>
      useGameController({ ...options(), initialState: over }),
    );

    let ok = false;
    await act(() => {
      ok = result.current.revive();
    });
    expect(ok).toBe(true);
    expect(result.current.state.status).toBe("playing");
    expect(result.current.state.reviveUsed).toBe(true);
    expect(result.current.state.score).toBe(500);

    let again = true;
    await act(() => {
      again = result.current.revive();
    });
    expect(again).toBe(false);
  });
});
