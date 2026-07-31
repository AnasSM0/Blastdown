import { act, render, renderHook } from "@testing-library/react-native";

import { CinematicBoard } from "../../src/components/CinematicBoard";
import { EffectStack } from "../../src/components/effects/EffectStack";
import type { GridCell as DomainGridCell } from "../../src/domain/gameTypes";
import { useEventAnimator } from "../../src/hooks/useEventAnimator";
import type { EffectPlan } from "../../src/ui/effects/eventEffects";
import type { EffectSequence } from "../../src/ui/effects/effectQueue";

/** The renderer contract for Priority 1.
 *
 *  The queue has held several effects for a while, with unique ids, priorities,
 *  deterministic eviction and session generations. Neither renderer ever drew
 *  more than one of them: `useEventAnimator` collapsed the queue to a single
 *  `plan`/`effectKey` through a `rank()` helper, and both the cinematic board
 *  and the React Native overlay consumed that scalar. Every effect after the
 *  highest-priority one was retained in state, retired on schedule, and never
 *  shown — which is indistinguishable, on a device, from the effect being lost.
 *
 *  These tests describe what "renders independently" has to mean, and every one
 *  of them fails against the single-plan renderers. */

const BOARD_SIDE = 328;

function grid(): DomainGridCell[][] {
  return Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, (): DomainGridCell => ({ kind: "empty" })),
  );
}

function plan(overrides: Partial<EffectPlan> = {}): EffectPlan {
  return {
    rows: [3],
    columns: [],
    clearedCells: Array.from({ length: 8 }, (_, column) => ({ row: 3, column })),
    defuses: [],
    explosions: [],
    rubbleCells: [],
    reviveCells: [],
    scoreDelta: 100,
    score: 100,
    combo: null,
    comboReset: false,
    cue: null,
    hasRequiredSequence: true,
    durationMs: 340,
    ...overrides,
  };
}

function sequence(id: string, priority: EffectSequence["priority"]): EffectSequence {
  return { id, priority, plan: plan() };
}

describe("the fallback renderer draws every queued effect", () => {
  it("mounts one layer per effect, not just the top one", async () => {
    const started: string[] = [];
    const view = await render(
      <EffectStack
        sequences={[sequence("s1:t1", "high"), sequence("s1:t2", "critical")]}
        cellSize={38}
        reducedMotion={false}
        onStarted={(id) => started.push(id)}
      />,
    );

    expect(started.sort()).toEqual(["s1:t1", "s1:t2"]);
    await view.unmount();
  });

  it("gives two effects of the same kind different keys", async () => {
    // Same plan shape, same priority, different turn. Keyed by plan identity or
    // by type they would collapse into one mounted layer and one report.
    const started: string[] = [];
    const view = await render(
      <EffectStack
        sequences={[sequence("s1:t4", "high"), sequence("s1:t5", "high")]}
        cellSize={38}
        reducedMotion={false}
        onStarted={(id) => started.push(id)}
      />,
    );

    expect(started).toHaveLength(2);
    expect(new Set(started).size).toBe(2);
    await view.unmount();
  });

  it("leaves the other effect alone when one retires", async () => {
    // Retiring an effect removes it from the list. The survivor must not remount
    // — a remount restarts its animation from zero and re-reports its draw,
    // which is the visible "effects reset each other" symptom.
    const started: string[] = [];
    const both = [sequence("s1:t1", "high"), sequence("s1:t2", "critical")];
    const view = await render(
      <EffectStack
        sequences={both}
        cellSize={38}
        reducedMotion={false}
        onStarted={(id) => started.push(id)}
      />,
    );
    await view.rerender(
      <EffectStack
        sequences={[both[1]]}
        cellSize={38}
        reducedMotion={false}
        onStarted={(id) => started.push(id)}
      />,
    );

    expect(started).toEqual(["s1:t1", "s1:t2"]);
    await view.unmount();
  });

  it("keeps active effects across a board state change", async () => {
    // A placement re-renders the screen. If that remounts the stack the effects
    // in flight restart, so an ordinary move visibly interrupts a clear.
    const started: string[] = [];
    const sequences = [sequence("s1:t1", "high")];
    const view = await render(
      <EffectStack
        sequences={sequences}
        cellSize={38}
        reducedMotion={false}
        onStarted={(id) => started.push(id)}
      />,
    );
    await view.rerender(
      <EffectStack
        sequences={sequences}
        cellSize={40}
        reducedMotion={false}
        onStarted={(id) => started.push(id)}
      />,
    );

    expect(started).toEqual(["s1:t1"]);
    await view.unmount();
  });
});

describe("the cinematic renderer draws every queued effect", () => {
  it("reports a draw for each sequence, not just the top one", async () => {
    const started: string[] = [];
    const view = await render(
      <CinematicBoard
        grid={grid()}
        badges={[]}
        boardSize={BOARD_SIDE}
        effectSequences={[sequence("s1:t1", "high"), sequence("s1:t2", "critical")]}
        onEffectStarted={(id) => started.push(id)}
      />,
    );

    expect(started.sort()).toEqual(["s1:t1", "s1:t2"]);
    await view.unmount();
  });

  it("keeps drawing the others when one retires", async () => {
    const started: string[] = [];
    const both = [sequence("s1:t1", "high"), sequence("s1:t2", "critical")];
    const view = await render(
      <CinematicBoard
        grid={grid()}
        badges={[]}
        boardSize={BOARD_SIDE}
        effectSequences={both}
        onEffectStarted={(id) => started.push(id)}
      />,
    );
    await view.rerender(
      <CinematicBoard
        grid={grid()}
        badges={[]}
        boardSize={BOARD_SIDE}
        effectSequences={[both[0]]}
        onEffectStarted={(id) => started.push(id)}
      />,
    );

    expect(started).toEqual(["s1:t1", "s1:t2"]);
    await view.unmount();
  });

  it("does not restart effects when the board grid changes", async () => {
    const started: string[] = [];
    const sequences = [sequence("s1:t1", "high")];
    const view = await render(
      <CinematicBoard
        grid={grid()}
        badges={[]}
        boardSize={BOARD_SIDE}
        effectSequences={sequences}
        onEffectStarted={(id) => started.push(id)}
      />,
    );
    const changed = grid();
    changed[0][0] = { kind: "rubble", explosionId: "e1" };
    await view.rerender(
      <CinematicBoard
        grid={changed}
        badges={[]}
        boardSize={BOARD_SIDE}
        effectSequences={sequences}
        onEffectStarted={(id) => started.push(id)}
      />,
    );

    expect(started).toEqual(["s1:t1"]);
    await view.unmount();
  });
});

describe("both renderers obey one contract", () => {
  it("reports the same ids for the same sequences", async () => {
    const fallback: string[] = [];
    const cinematic: string[] = [];
    const sequences = [sequence("same:1", "standard"), sequence("same:2", "critical")];

    const a = await render(
      <EffectStack
        sequences={sequences}
        cellSize={38}
        reducedMotion={false}
        onStarted={(id) => fallback.push(id)}
      />,
    );
    const b = await render(
      <CinematicBoard
        grid={grid()}
        badges={[]}
        boardSize={BOARD_SIDE}
        effectSequences={sequences}
        onEffectStarted={(id) => cinematic.push(id)}
      />,
    );

    expect(fallback.sort()).toEqual(cinematic.sort());
    await a.unmount();
    await b.unmount();
  });
});

describe("the animator hands the renderers a drawing order", () => {
  const EMPTY_GRID = grid();

  it("orders standard below high below critical", async () => {
    const { result } = await renderHook(() =>
      useEventAnimator({ turn: 0, events: [], grid: EMPTY_GRID, reducedMotion: false }),
    );

    await act(async () => {
      result.current.playCue("revive", [{ row: 0, column: 0 }]);
    });

    // Later effects must not simply stack on top: a standard-priority score
    // comment admitted after a critical explosion still draws underneath it.
    const priorities = result.current.effects.map((effect) => effect.priority);
    const rank = { standard: 1, high: 2, critical: 3 } as const;
    const ranks = priorities.map((priority) => rank[priority]);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it("clears every previous-session effect on restart", async () => {
    const { result } = await renderHook(() =>
      useEventAnimator({ turn: 0, events: [], grid: EMPTY_GRID, reducedMotion: false }),
    );

    await act(async () => {
      result.current.playCue("revive", [{ row: 0, column: 0 }]);
    });
    expect(result.current.effects.length).toBeGreaterThan(0);

    await act(async () => {
      result.current.reset();
    });
    expect(result.current.effects).toEqual([]);
  });
});
