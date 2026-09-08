import { act, render, renderHook } from "@testing-library/react-native";
import { useEffect } from "react";

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
  afterEach(async () => {
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it("reports a required sequence as active until its duration ends", async () => {
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
    // Effects are individually identified now, so the key is an id rather than
    // a counter -- see src/ui/effects/effectQueue.ts.
    expect(typeof result.current.effectKey).toBe("string");

    await act(async () => {
      // Nothing draws under jest, so the admission watchdog retires this rather
      // than the precise renderer-reported timer: duration plus the grace.
      jest.advanceTimersByTime(340 + 400);
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
      jest.advanceTimersByTime(400 + 400);
    });
    expect(result.current.plan).toBeNull();
  });

  it("keeps a cue that arrives while a required sequence is playing", async () => {
    // This test used to assert the opposite, and the opposite was the bug: a
    // rewarded defuse or revive fired during a clear was dropped outright, so
    // the player spent an ad and saw nothing. Both are live now.
    const { result, rerender } = await renderHook(
      (props: { turn: number; events: GameEvent[]; reducedMotion: boolean }) =>
        useEventAnimator({ ...props, grid: EMPTY_GRID }),
      { initialProps: { turn: 0, events: [] as GameEvent[], reducedMotion: false } },
    );
    await act(async () => {
      rerender({ turn: 1, events: CLEAR_TURN, reducedMotion: false });
    });
    expect(result.current.isAnimating).toBe(true);

    await act(async () => {
      result.current.playCue("revive", [{ row: 0, column: 0 }]);
    });

    expect(result.current.effects).toHaveLength(2);
    expect(result.current.effects.some((effect) => effect.plan.cue === "revive")).toBe(true);
    // The clear remains the required turn sequence; the cue is independent.
    expect(result.current.isAnimating).toBe(true);
    // A rewarded outcome outranks a clear, so the single-plan renderer shows it.
    expect(result.current.plan?.cue).toBe("revive");
  });

  it("keeps both effects when a turn lands while a cue is playing", async () => {
    const { result, rerender } = await renderHook(
      (props: { turn: number; events: GameEvent[]; reducedMotion: boolean }) =>
        useEventAnimator({ ...props, grid: EMPTY_GRID }),
      { initialProps: { turn: 0, events: [] as GameEvent[], reducedMotion: false } },
    );
    await act(async () => {
      result.current.playCue("revive", [{ row: 0, column: 0 }]);
    });
    await act(async () => {
      rerender({ turn: 1, events: CLEAR_TURN, reducedMotion: false });
    });

    // The old hook called stop() here, wiping the cue mid-play.
    expect(result.current.effects).toHaveLength(2);
  });

  it("keeps an earlier turn's progress when a consecutive turn is admitted", async () => {
    const { result, rerender } = await renderHook(
      (props: { turn: number; events: GameEvent[]; reducedMotion: boolean }) =>
        useEventAnimator({ ...props, grid: EMPTY_GRID }),
      { initialProps: { turn: 0, events: [] as GameEvent[], reducedMotion: false } },
    );
    await act(async () => {
      rerender({ turn: 1, events: CLEAR_TURN, reducedMotion: false });
    });
    const firstId = result.current.effects[0].id;
    await act(async () => {
      result.current.startedDrawing(firstId, 125);
    });

    await act(async () => {
      rerender({ turn: 2, events: CLEAR_TURN, reducedMotion: false });
    });

    expect(result.current.effects).toHaveLength(2);
    expect(result.current.effects.find((effect) => effect.id === firstId)?.startedAt).toBe(125);
  });

  it("waits for a slow renderer instead of eating the effect", async () => {
    // The bug the first watchdog reintroduced. It retired unconditionally after
    // duration plus a grace window, so any renderer slower than that grace lost
    // the effect entirely -- which is exactly the "intermittently missing under
    // load" symptom, because a stalled frame is when the delay is longest.
    //
    // A renderer that has reported a draw before is participating, so an
    // unstarted effect is waited for rather than cut short.
    const { result, rerender } = await renderHook(
      (props: { turn: number; events: GameEvent[]; reducedMotion: boolean }) =>
        useEventAnimator({ ...props, grid: EMPTY_GRID }),
      { initialProps: { turn: 0, events: [] as GameEvent[], reducedMotion: false } },
    );

    // Turn 1 draws normally, which latches "this renderer reports draws".
    await act(async () => {
      rerender({ turn: 1, events: CLEAR_TURN, reducedMotion: false });
    });
    await act(async () => {
      result.current.startedDrawing(result.current.effects[0].id, 0);
    });
    await act(async () => {
      jest.advanceTimersByTime(340);
    });
    expect(result.current.effects).toHaveLength(0);

    // Turn 2 arrives and the renderer stalls well past the grace window.
    await act(async () => {
      rerender({ turn: 2, events: CLEAR_TURN, reducedMotion: false });
    });
    const stalled = result.current.effects[0];
    expect(stalled.startedAt).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(340 + 400 + 50);
    });

    // Still live: the renderer participates, so it gets waited for.
    expect(result.current.effects.map((effect) => effect.id)).toContain(stalled.id);

    // And when it finally draws, the effect plays its whole lifecycle.
    await act(async () => {
      result.current.startedDrawing(stalled.id, 1000);
    });
    expect(result.current.effects[0].startedAt).toBe(1000);
  });

  it("still retires for a renderer that never reports a draw", async () => {
    // The other half, and why the watchdog exists at all. The React Native
    // fallback never calls startedDrawing, so waiting forever would leave a
    // required sequence mounted indefinitely.
    const { result, rerender } = await renderHook(
      (props: { turn: number; events: GameEvent[]; reducedMotion: boolean }) =>
        useEventAnimator({ ...props, grid: EMPTY_GRID }),
      { initialProps: { turn: 0, events: [] as GameEvent[], reducedMotion: false } },
    );
    await act(async () => {
      rerender({ turn: 1, events: CLEAR_TURN, reducedMotion: false });
    });
    expect(result.current.isAnimating).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(340 + 400);
    });

    expect(result.current.effects).toHaveLength(0);
    expect(result.current.isAnimating).toBe(false);
  });

  it("gives up on a participating renderer that stops drawing", async () => {
    // A board unmounted mid-sequence must not retain stale presentation forever, so
    // the waiting is bounded rather than open-ended.
    const { result, rerender } = await renderHook(
      (props: { turn: number; events: GameEvent[]; reducedMotion: boolean }) =>
        useEventAnimator({ ...props, grid: EMPTY_GRID }),
      { initialProps: { turn: 0, events: [] as GameEvent[], reducedMotion: false } },
    );
    await act(async () => {
      rerender({ turn: 1, events: CLEAR_TURN, reducedMotion: false });
    });
    await act(async () => {
      result.current.startedDrawing(result.current.effects[0].id, 0);
    });
    await act(async () => {
      jest.advanceTimersByTime(340);
    });

    await act(async () => {
      rerender({ turn: 2, events: CLEAR_TURN, reducedMotion: false });
    });
    expect(result.current.effects).toHaveLength(1);

    // Never drawn. Four windows (the first plus three extensions) and it goes.
    await act(async () => {
      jest.advanceTimersByTime((340 + 400) * 5);
    });

    expect(result.current.effects).toHaveLength(0);
    expect(result.current.isAnimating).toBe(false);
  });

  it("stamps the start even though the child reports before the parent syncs", async () => {
    // The ordering bug that made the whole mechanism inert while looking wired.
    //
    // React runs CHILD effects before PARENT effects. The animator lives in the
    // game screen and the effect layers are its descendants, so on the render
    // where an effect first appears the layer reports the draw before the
    // parent has synced its own view of the queue. An earlier version looked
    // the effect up in that stale ref and returned early — and since a layer
    // reports exactly once per effect id, the single report was always lost.
    //
    // renderHook could not see this: act() flushes every effect before the
    // assertions run, so the ref was always current by then. This test mounts a
    // real child whose mount effect reports, which reproduces the true order.
    const seen: { startedAt: number | null; reports: boolean }[] = [];

    function Child({ id, onStarted }: { id: string | null; onStarted: (id: string) => void }) {
      useEffect(() => {
        if (id != null) {
          onStarted(id);
        }
      }, [id, onStarted]);
      return null;
    }

    function Harness({ turn, events }: { turn: number; events: GameEvent[] }) {
      const animator = useEventAnimator({
        turn,
        events,
        grid: EMPTY_GRID,
        reducedMotion: false,
      });
      seen.push({
        startedAt: animator.effects[0]?.startedAt ?? null,
        reports: animator.effects.length > 0,
      });
      return <Child id={animator.effectKey} onStarted={(id) => animator.startedDrawing(id, 500)} />;
    }

    const view = await render(<Harness turn={0} events={[]} />);
    await act(async () => {
      await view.rerender(<Harness turn={1} events={CLEAR_TURN} />);
    });

    // The stamp landed, which it did not before: the report is applied through
    // the state updater rather than through a ref the child outran.
    const stamped = seen.filter((entry) => entry.startedAt !== null);
    expect(stamped.length).toBeGreaterThan(0);
    expect(stamped[stamped.length - 1].startedAt).toBe(500);

    await view.unmount();
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
          { type: "pieceDefused", pieceId: "p-defused", bonus: 50, remainingTurns: 3 },
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
