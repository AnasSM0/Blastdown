import { act, renderHook } from "@testing-library/react-native";

import { useEventAnimator } from "../../src/hooks/useEventAnimator";
import type { GameEvent } from "../../src/domain/events";
import type { GridCell } from "../../src/domain/gameTypes";

/** The hook reads the grid only to resolve a defused piece's footprint; these
 *  cases exercise sequencing, so an empty board is enough. */
const EMPTY_GRID: GridCell[][] = Array.from({ length: 8 }, () =>
  Array.from({ length: 8 }, (): GridCell => ({ kind: "empty" })),
);

const CLEAR_TURN: GameEvent[] = [
  { type: "piecePlaced", handId: "h1", pieceId: "piece-1", cells: [{ row: 0, column: 0 }] },
  { type: "linesCleared", rows: [0], columns: [] },
  { type: "scoreChanged", delta: 100, score: 100 },
];

const PLAIN_TURN: GameEvent[] = [
  { type: "piecePlaced", handId: "h2", pieceId: "piece-2", cells: [{ row: 1, column: 1 }] },
  { type: "scoreChanged", delta: 4, score: 4 },
];

describe("useEventAnimator", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("locks input for a required sequence, then unlocks after its duration", async () => {
    const { result, rerender } = await renderHook(
      (props: { turn: number; events: GameEvent[]; reducedMotion: boolean }) =>
        useEventAnimator({ ...props, grid: EMPTY_GRID }),
      {
        initialProps: { turn: 0, events: [] as GameEvent[], reducedMotion: false },
      },
    );
    expect(result.current.isAnimating).toBe(false);

    await act(async () => {
      rerender({ turn: 1, events: CLEAR_TURN, reducedMotion: false });
    });
    expect(result.current.isAnimating).toBe(true);
    expect(result.current.plan?.clearedCells).toHaveLength(8);
    expect(result.current.effectKey).toBe(1);

    await act(async () => {
      jest.advanceTimersByTime(340);
    });
    expect(result.current.isAnimating).toBe(false);
    expect(result.current.plan).toBeNull();
  });

  it("does not lock for a plain placement", async () => {
    const { result, rerender } = await renderHook(
      (props: { turn: number; events: GameEvent[]; reducedMotion: boolean }) =>
        useEventAnimator({ ...props, grid: EMPTY_GRID }),
      {
        initialProps: { turn: 0, events: [] as GameEvent[], reducedMotion: false },
      },
    );
    await act(async () => {
      rerender({ turn: 1, events: PLAIN_TURN, reducedMotion: false });
    });
    expect(result.current.isAnimating).toBe(false);
    expect(result.current.plan).toBeNull();
  });

  it("animates each new turn once and not on a restart back to turn 0", async () => {
    const { result, rerender } = await renderHook(
      (props: { turn: number; events: GameEvent[]; reducedMotion: boolean }) =>
        useEventAnimator({ ...props, grid: EMPTY_GRID }),
      {
        initialProps: { turn: 1, events: CLEAR_TURN, reducedMotion: false },
      },
    );
    // Same turn re-render must not restart the sequence.
    const keyAfterFirst = result.current.effectKey;
    await act(async () => {
      rerender({ turn: 1, events: CLEAR_TURN, reducedMotion: false });
    });
    expect(result.current.effectKey).toBe(keyAfterFirst);

    // A restart (turn → 0) clears without animating.
    await act(async () => {
      rerender({ turn: 0, events: [], reducedMotion: false });
    });
    expect(result.current.isAnimating).toBe(false);
  });

  it("plays an out-of-turn cue without locking input, then clears it", async () => {
    const { result } = await renderHook(() =>
      useEventAnimator({ turn: 0, events: [], grid: EMPTY_GRID, reducedMotion: false }),
    );

    await act(async () => {
      result.current.playCue("revive", [{ row: 2, column: 2 }]);
    });
    expect(result.current.plan?.cue).toBe("revive");
    expect(result.current.plan?.reviveCells).toEqual([{ row: 2, column: 2 }]);
    // A revive/rewarded defuse must leave the board usable straight away.
    expect(result.current.isAnimating).toBe(false);

    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    expect(result.current.plan).toBeNull();
  });

  it("ignores a cue while a required sequence is playing, so it can't cut one short", async () => {
    const { result, rerender } = await renderHook(
      (props: { turn: number; events: GameEvent[]; reducedMotion: boolean }) =>
        useEventAnimator({ ...props, grid: EMPTY_GRID }),
      { initialProps: { turn: 0, events: [] as GameEvent[], reducedMotion: false } },
    );
    await act(async () => {
      rerender({ turn: 1, events: CLEAR_TURN, reducedMotion: false });
    });
    expect(result.current.isAnimating).toBe(true);
    const keyDuringSequence = result.current.effectKey;

    await act(async () => {
      result.current.playCue("revive", [{ row: 0, column: 0 }]);
    });
    // The clear keeps the overlay and the input lock.
    expect(result.current.effectKey).toBe(keyDuringSequence);
    expect(result.current.plan?.cue).toBeNull();
    expect(result.current.isAnimating).toBe(true);
  });

  it("ignores a cue with no cells (nothing was restored or defused)", async () => {
    const { result } = await renderHook(() =>
      useEventAnimator({ turn: 0, events: [], grid: EMPTY_GRID, reducedMotion: false }),
    );
    await act(async () => {
      result.current.playCue("revive", []);
    });
    expect(result.current.plan).toBeNull();
  });

  it("resolves a defused piece's cells from the grid as it stood before the turn", async () => {
    const before: GridCell[][] = EMPTY_GRID.map((row) => [...row]);
    before[4][4] = { kind: "timed", pieceInstanceId: "p-defused", colorId: "cyan" };

    const { result, rerender } = await renderHook(
      (props: { turn: number; events: GameEvent[]; grid: GridCell[][] }) =>
        useEventAnimator({ ...props, reducedMotion: false }),
      { initialProps: { turn: 0, events: [] as GameEvent[], grid: before } },
    );

    // The turn clears the piece: it is gone from the NEW grid, so only the
    // retained pre-turn grid can say where it was.
    await act(async () => {
      rerender({
        turn: 1,
        events: [
          { type: "linesCleared", rows: [4], columns: [] },
          { type: "pieceDefused", pieceId: "p-defused", bonus: 50 },
        ],
        grid: EMPTY_GRID,
      });
    });

    expect(result.current.plan?.defuses[0].cells).toEqual([{ row: 4, column: 4 }]);
  });

  it("reset cancels a playing sequence immediately", async () => {
    const { result, rerender } = await renderHook(
      (props: { turn: number; events: GameEvent[]; reducedMotion: boolean }) =>
        useEventAnimator({ ...props, grid: EMPTY_GRID }),
      {
        initialProps: { turn: 0, events: [] as GameEvent[], reducedMotion: false },
      },
    );
    await act(async () => {
      rerender({ turn: 1, events: CLEAR_TURN, reducedMotion: false });
    });
    expect(result.current.isAnimating).toBe(true);

    await act(async () => {
      result.current.reset();
    });
    expect(result.current.isAnimating).toBe(false);
    expect(result.current.plan).toBeNull();
  });
});
