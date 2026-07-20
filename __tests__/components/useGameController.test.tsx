import { act, renderHook } from "@testing-library/react-native";

import { useGameController } from "../../src/hooks/useGameController";

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
