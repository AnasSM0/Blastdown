import { act, render } from "@testing-library/react-native";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { CinematicBoard } from "../../src/components/CinematicBoard";
import { EffectStack } from "../../src/components/effects/EffectStack";
import { EffectDiagnosticsOverlay } from "../../src/dev/EffectDiagnosticsOverlay";
import { HARNESS_STEP_MS, useEffectHarnessRunner } from "../../src/dev/useEffectHarnessRunner";
import type { GridCell as DomainGridCell } from "../../src/domain/gameTypes";
import { useEventAnimator, type EventAnimator } from "../../src/hooks/useEventAnimator";
import {
  DIAGNOSTICS_REFRESH_MS,
  EFFECT_LOG_KINDS,
  readEffectDiagnostics,
  recordClockLeases,
  recordEffectEnqueue,
  recordQueueTransition,
  resetEffectDiagnostics,
  setEffectDiagnosticsLogger,
  type EffectLogEntry,
} from "../../src/ui/effects/effectDiagnostics";
import {
  admitEffect,
  createEffectQueue,
  resetSession,
  retireEffect,
  startEffect,
  type EffectQueue,
} from "../../src/ui/effects/effectQueue";
import type { EffectPlan } from "../../src/ui/effects/eventEffects";

/** What the device overlay has to be able to tell a tester.
 *
 *  "The effect did not appear" is not a report anyone can act on. It could be
 *  the queue refusing the admission, the renderer never drawing it, an eviction
 *  under pressure, a stale session dropping it, or a start report the animator
 *  never received. Those five have five different fixes and look identical from
 *  the sofa.
 *
 *  The recorder below turns each of them into a counter, derived from committed
 *  queue transitions rather than from side effects inside a state updater — so
 *  a re-render cannot count the same acceptance twice, which is exactly the
 *  failure mode that would make the overlay lie in the direction of "everything
 *  is fine". */

const EMPTY_GRID: DomainGridCell[][] = Array.from({ length: 8 }, () =>
  Array.from({ length: 8 }, (): DomainGridCell => ({ kind: "empty" })),
);

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
    clear: overrides.clear ?? null,
    boardImpulse: overrides.boardImpulse ?? null,
  };
}

function admit(queue: EffectQueue, id: string, overrides: Partial<EffectPlan> = {}): EffectQueue {
  const built = plan(overrides);
  return admitEffect(queue, {
    id,
    sessionId: queue.sessionId,
    priority: built.explosions.length > 0 || built.cue !== null ? "critical" : "high",
    plan: built,
    durationMs: built.durationMs,
  });
}

/** Feed the recorder a transition the way `useEventAnimator` does: enqueue
 *  attempts first, then the committed before/after pair. */
function step(before: EffectQueue, after: EffectQueue, at: number): void {
  recordQueueTransition(before, after, at);
}

describe("the diagnostics recorder counts what happened", () => {
  beforeEach(() => {
    resetEffectDiagnostics();
    setEffectDiagnosticsLogger(null);
  });

  it("starts at zero with no session cleared", () => {
    const snapshot = readEffectDiagnostics(0);

    expect(snapshot.accepted).toBe(0);
    expect(snapshot.startedDrawing).toBe(0);
    expect(snapshot.completed).toBe(0);
    expect(snapshot.evicted).toBe(0);
    expect(snapshot.dropped).toBe(0);
    expect(snapshot.queueDepth).toBe(0);
    expect(snapshot.effects).toEqual([]);
  });

  it("counts an acceptance once, however many times the same commit is observed", () => {
    const before = createEffectQueue();
    recordEffectEnqueue("s1:t1", 1, 0);
    const after = admit(before, "s1:t1");

    step(before, after, 10);
    // React can hand the same committed value back on a re-render; the recorder
    // must be idempotent or every re-render inflates the counters.
    step(after, after, 11);

    const snapshot = readEffectDiagnostics(20);
    expect(snapshot.accepted).toBe(1);
    expect(snapshot.dropped).toBe(0);
    expect(snapshot.queueDepth).toBe(1);
  });

  it("counts a refused admission as dropped", () => {
    const before = createEffectQueue();
    recordEffectEnqueue("s1:t1", 1, 0);
    const after = admit(before, "s1:t1");
    step(before, after, 10);

    // The same id again: a duplicate, which `admitEffect` refuses. Nothing is
    // added, so nothing appears in the transition — the attempt is the only
    // evidence it happened.
    recordEffectEnqueue("s1:t1", 1, 20);
    step(after, admit(after, "s1:t1"), 25);

    const snapshot = readEffectDiagnostics(30);
    expect(snapshot.accepted).toBe(1);
    expect(snapshot.dropped).toBe(1);
  });

  it("records the draw report and the latency it took to arrive", () => {
    const before = createEffectQueue();
    recordEffectEnqueue("s1:t1", 1, 100);
    const admitted = admit(before, "s1:t1");
    step(before, admitted, 100);

    const drawn = startEffect(admitted, "s1:t1", 180);
    step(admitted, drawn, 180);

    const snapshot = readEffectDiagnostics(200);
    expect(snapshot.startedDrawing).toBe(1);
    expect(snapshot.renderedCount).toBe(1);
    expect(snapshot.lastLatencyMs).toBe(80);
    expect(snapshot.maxLatencyMs).toBe(80);
    expect(snapshot.effects[0].latencyMs).toBe(80);
  });

  it("ages an effect that has been admitted but never drawn", () => {
    const before = createEffectQueue();
    recordEffectEnqueue("s1:t1", 1, 100);
    step(before, admit(before, "s1:t1"), 100);

    const snapshot = readEffectDiagnostics(460);
    // The single number that separates "the renderer is slow" from "the
    // renderer never reports": a waiting age that keeps climbing.
    expect(snapshot.oldestWaitingMs).toBe(360);
    expect(snapshot.effects[0].latencyMs).toBeNull();
  });

  it("separates an effect that finished from one that was evicted", () => {
    let queue = createEffectQueue();
    for (let turn = 1; turn <= 6; turn += 1) {
      const id = `s1:t${turn}`;
      recordEffectEnqueue(id, 1, turn);
      const next = admit(queue, id);
      step(queue, next, turn);
      queue = next;
    }
    expect(readEffectDiagnostics(10).accepted).toBe(6);

    // A retirement: the effect drew and its timer removed it.
    const drawn = startEffect(queue, "s1:t2", 10);
    step(queue, drawn, 10);
    const retired = retireEffect(drawn, "s1:t2");
    step(drawn, retired, 20);
    expect(readEffectDiagnostics(20).completed).toBe(1);
    expect(readEffectDiagnostics(20).evicted).toBe(0);

    // Refill to the cap, then push one past it. The victim is the oldest of the
    // lowest priority, and it leaves in the SAME commit as an acceptance —
    // which is how the recorder tells eviction from ordinary retirement.
    recordEffectEnqueue("s1:t7", 1, 30);
    const seventh = admit(retired, "s1:t7");
    step(retired, seventh, 30);
    recordEffectEnqueue("s1:t8", 1, 40);
    const eighth = admit(seventh, "s1:t8");
    step(seventh, eighth, 40);

    const snapshot = readEffectDiagnostics(50);
    expect(snapshot.evicted).toBe(1);
    expect(snapshot.completed).toBe(1);
    expect(snapshot.queueDepth).toBe(6);
  });

  it("reports a session change as cleared rather than as six completions", () => {
    let queue = createEffectQueue();
    for (let turn = 1; turn <= 3; turn += 1) {
      const id = `s1:t${turn}`;
      recordEffectEnqueue(id, 1, turn);
      const next = admit(queue, id);
      step(queue, next, turn);
      queue = next;
    }

    const cleared = resetSession(queue);
    step(queue, cleared, 100);

    const snapshot = readEffectDiagnostics(100);
    // Three effects vanished, and none of them finished. Counting them as
    // completions would report a healthy run that never drew anything.
    expect(snapshot.sessionCleared).toBe(1);
    expect(snapshot.completed).toBe(0);
    expect(snapshot.evicted).toBe(0);
    expect(snapshot.sessionId).toBe(2);
    expect(snapshot.queueDepth).toBe(0);
    expect(snapshot.effects).toEqual([]);
  });

  it("shows each live effect's id, type, priority and leased clock slot", () => {
    const before = createEffectQueue();
    recordEffectEnqueue("s1:t1", 1, 0);
    const clear = admit(before, "s1:t1");
    step(before, clear, 0);
    recordEffectEnqueue("s1:t2", 1, 1);
    const boom = admit(clear, "s1:t2", {
      explosions: [{ explosionId: "x1", pieceId: "p1", cells: [{ row: 0, column: 0 }] }],
      rubbleCells: [{ row: 0, column: 0 }],
    });
    step(clear, boom, 1);

    recordClockLeases(
      new Map([
        ["s1:t1", 0],
        ["s1:t2", 3],
      ]),
    );

    const snapshot = readEffectDiagnostics(2);
    expect(snapshot.effects.map((row) => [row.id, row.type, row.priority, row.slot])).toEqual([
      ["s1:t1", "clear", "high", 0],
      ["s1:t2", "explosion", "critical", 3],
    ]);
  });

  it("reports no leased slot while the cinematic renderer is not mounted", () => {
    const before = createEffectQueue();
    recordEffectEnqueue("s1:t1", 1, 0);
    step(before, admit(before, "s1:t1"), 0);

    // The fallback renderer holds no clock pool, so the column is honestly
    // empty rather than reporting a slot nothing leased.
    expect(readEffectDiagnostics(1).effects[0].slot).toBeNull();
  });
});

describe("the recorder logs structurally and sparingly", () => {
  let entries: EffectLogEntry[] = [];

  beforeEach(() => {
    resetEffectDiagnostics();
    entries = [];
    setEffectDiagnosticsLogger((entry) => entries.push(entry));
  });

  afterEach(() => {
    setEffectDiagnosticsLogger(null);
  });

  it("emits only the six lifecycle kinds", () => {
    let queue = createEffectQueue();
    recordEffectEnqueue("s1:t1", 1, 0);
    const admitted = admit(queue, "s1:t1");
    step(queue, admitted, 0);
    const drawn = startEffect(admitted, "s1:t1", 5);
    step(admitted, drawn, 5);
    queue = retireEffect(drawn, "s1:t1");
    step(drawn, queue, 10);
    step(queue, resetSession(queue), 15);

    expect(entries.map((entry) => entry.kind)).toEqual([
      "enqueue",
      "accepted",
      "startedDrawing",
      "completed",
      "sessionCleared",
    ]);
    for (const entry of entries) {
      expect(EFFECT_LOG_KINDS).toContain(entry.kind);
    }
  });

  it("logs nothing when the overlay merely reads a snapshot", () => {
    recordEffectEnqueue("s1:t1", 1, 0);
    entries = [];

    for (let read = 0; read < 20; read += 1) {
      readEffectDiagnostics(read);
    }

    // A log per read is a log per refresh, which on a device is a log per frame
    // in everything but name.
    expect(entries).toEqual([]);
  });

  it("logs nothing for a transition that changed nothing", () => {
    const queue = createEffectQueue();
    entries = [];

    for (let read = 0; read < 20; read += 1) {
      step(queue, queue, read);
    }

    expect(entries).toEqual([]);
  });
});

describe("the diagnostics overlay", () => {
  beforeEach(() => {
    resetEffectDiagnostics();
    setEffectDiagnosticsLogger(null);
    jest.useFakeTimers();
  });

  afterEach(() => {
    // Cleared rather than run: the overlay's own refresh is the only pending
    // timer, and firing it after the test has finished sets state on an
    // unmounted tree for no benefit.
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("shows every field the device procedure reads", async () => {
    const before = createEffectQueue();
    recordEffectEnqueue("s1:t1", 1, 0);
    const admitted = admit(before, "s1:t1");
    step(before, admitted, 0);
    step(admitted, startEffect(admitted, "s1:t1", 40), 40);

    const view = await render(<EffectDiagnosticsOverlay />);

    for (const testID of [
      "effect-diagnostics-queue-depth",
      "effect-diagnostics-rendered",
      "effect-diagnostics-accepted",
      "effect-diagnostics-started",
      "effect-diagnostics-completed",
      "effect-diagnostics-evicted",
      "effect-diagnostics-dropped",
      "effect-diagnostics-session",
      "effect-diagnostics-cinematic",
      "effect-diagnostics-oldest-waiting",
      "effect-diagnostics-latency",
      "effect-diagnostics-row-s1:t1",
    ]) {
      expect(view.getByTestId(testID)).toBeTruthy();
    }

    await view.unmount();
  });

  it("refreshes on an interval rather than on every frame", async () => {
    const view = await render(<EffectDiagnosticsOverlay />);
    expect(view.getByTestId("effect-diagnostics-accepted")).toHaveTextContent("0");

    const before = createEffectQueue();
    recordEffectEnqueue("s1:t1", 1, 0);
    step(before, admit(before, "s1:t1"), 0);

    // A frame's worth of time. An overlay driven by an animation frame, or one
    // that re-rendered on every recorded transition, would already show the new
    // value — and on a device that cost lands on exactly the frames the effects
    // need.
    await act(async () => {
      jest.advanceTimersByTime(16);
    });
    expect(view.getByTestId("effect-diagnostics-accepted")).toHaveTextContent("0");

    await act(async () => {
      jest.advanceTimersByTime(DIAGNOSTICS_REFRESH_MS);
    });
    expect(view.getByTestId("effect-diagnostics-accepted")).toHaveTextContent("1");
    // Slow enough that the overlay is never the reason a frame is late.
    expect(DIAGNOSTICS_REFRESH_MS).toBeGreaterThanOrEqual(100);

    await view.unmount();
  });
});

describe("both renderers report the same delivery", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  function Wired({
    cinematic,
    onRunner,
  }: {
    cinematic: boolean;
    onRunner: (runner: { run: (id: string) => void; idle: () => boolean }) => void;
  }) {
    const animatorRef = useRef<EventAnimator | null>(null);
    const playCue = useCallback<EventAnimator["playCue"]>((kind, cells) => {
      animatorRef.current?.playCue(kind, cells);
    }, []);
    const reset = useCallback(() => {
      animatorRef.current?.reset();
    }, []);
    const hooks = useMemo(() => ({ playCue, reset }), [playCue, reset]);
    const runner = useEffectHarnessRunner(hooks);
    const animator = useEventAnimator({
      turn: runner.turn,
      events: runner.events,
      grid: EMPTY_GRID,
      reducedMotion: false,
    });
    useEffect(() => {
      animatorRef.current = animator;
      onRunner({ run: runner.run, idle: () => runner.idle });
    });

    return cinematic ? (
      <CinematicBoard
        grid={EMPTY_GRID}
        badges={[]}
        boardSize={328}
        effectSequences={animator.sequences}
        onEffectStarted={animator.startedDrawing}
      />
    ) : (
      <EffectStack
        sequences={animator.sequences}
        cellSize={38}
        reducedMotion={false}
        onStarted={animator.startedDrawing}
      />
    );
  }

  async function deliver(cinematic: boolean, scenarioId: string) {
    resetEffectDiagnostics();
    let handle: { run: (id: string) => void; idle: () => boolean } | null = null;
    const view = await render(
      <Wired
        cinematic={cinematic}
        onRunner={(next) => {
          handle = next;
        }}
      />,
    );
    await act(async () => {
      handle!.run(scenarioId);
    });
    // One scripted step per advance, exactly as the harness's own suite drives
    // it. Six steps is 96ms of fake time, well short of the 450ms a clear takes
    // to retire, so nothing finishes before the snapshot is read.
    for (let guard = 0; guard < 64 && !handle!.idle(); guard += 1) {
      await act(async () => {
        jest.advanceTimersByTime(HARNESS_STEP_MS);
      });
    }
    const snapshot = readEffectDiagnostics(0);
    await view.unmount();
    return snapshot;
  }

  it("delivers the same effects through the fallback and the cinematic path", async () => {
    const fallback = await deliver(false, "six-rapid");
    const cinematic = await deliver(true, "six-rapid");

    // The renderers differ in everything except what they owe the queue: draw
    // every live effect, once each, and report it.
    expect(fallback.accepted).toBe(cinematic.accepted);
    expect(fallback.startedDrawing).toBe(cinematic.startedDrawing);
    expect(fallback.dropped).toBe(cinematic.dropped);
    expect(fallback.queueDepth).toBe(cinematic.queueDepth);
    expect(fallback.effects.map((row) => row.id)).toEqual(cinematic.effects.map((row) => row.id));
  });

  it("reports each draw exactly once on either path", async () => {
    const fallback = await deliver(false, "six-rapid");
    const cinematic = await deliver(true, "six-rapid");

    // Six effects, six start reports. A remount would announce a second draw
    // for an effect already in flight, and the counter is what makes that
    // visible instead of merely suspected.
    expect(fallback.startedDrawing).toBe(6);
    expect(cinematic.startedDrawing).toBe(6);
    expect(cinematic.renderedCount).toBe(6);
  });

  it("leases a distinct clock slot to each live cinematic effect", async () => {
    const cinematic = await deliver(true, "six-rapid");

    const slots = cinematic.effects.map((row) => row.slot);
    expect(slots.every((slot) => slot !== null)).toBe(true);
    expect(new Set(slots).size).toBe(slots.length);
  });
});

describe("the development modules stay out of the startup path", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync, readdirSync, statSync } = require("fs") as {
    readFileSync: (path: string, encoding: string) => string;
    readdirSync: (path: string) => string[];
    statSync: (path: string) => { isDirectory: () => boolean };
  };

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const path = `${dir}/${entry}`;
      if (statSync(path).isDirectory()) {
        return sourceFiles(path);
      }
      return path.endsWith(".ts") || path.endsWith(".tsx") ? [path] : [];
    });
  }

  it("keeps Skia out of the harness and the diagnostics", () => {
    const offenders = [...sourceFiles("src/dev"), "src/ui/effects/effectDiagnostics.ts"].filter(
      (file) => /from "@shopify\/react-native-skia"/.test(readFileSync(file, "utf8")),
    );

    // With the flag off the cinematic graph must never be evaluated. A harness
    // that imported Skia to show a board would put it back into startup for
    // every development build, which is where the flag gets exercised.
    expect(offenders).toEqual([]);
  });

  it("picks the harness board through the same flag-gated resolver the game uses", () => {
    const source = readFileSync("src/dev/EffectHarnessScreen.tsx", "utf8");

    expect(source).toMatch(/from "\.\.\/rendering\/boardRenderer"/);
    expect(/^import\s[^;]*from\s+".*CinematicBoard"/m.test(source)).toBe(false);
  });

  it("leaves the dev route rendering nothing outside a development build", () => {
    const source = readFileSync("app/dev-effects.tsx", "utf8");

    // The screen is reached through a require behind the dev gate, so a
    // production bundle carries the route file and nothing behind it.
    expect(source).toMatch(/resolveEffectHarness/);
    expect(/^import\s[^;]*EffectHarnessScreen/m.test(source)).toBe(false);
  });
});
