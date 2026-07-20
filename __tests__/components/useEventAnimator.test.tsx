import { act, renderHook } from "@testing-library/react-native";

import { useEventAnimator } from "../../src/hooks/useEventAnimator";
import type { GameEvent } from "../../src/domain/events";

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
        useEventAnimator(props),
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
      jest.advanceTimersByTime(320);
    });
    expect(result.current.isAnimating).toBe(false);
    expect(result.current.plan).toBeNull();
  });

  it("does not lock for a plain placement", async () => {
    const { result, rerender } = await renderHook(
      (props: { turn: number; events: GameEvent[]; reducedMotion: boolean }) =>
        useEventAnimator(props),
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
        useEventAnimator(props),
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

  it("reset cancels a playing sequence immediately", async () => {
    const { result, rerender } = await renderHook(
      (props: { turn: number; events: GameEvent[]; reducedMotion: boolean }) =>
        useEventAnimator(props),
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
