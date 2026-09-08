import { act, fireEvent, render } from "@testing-library/react-native";
import { useCallback, useEffect, useMemo, useRef, type ComponentType } from "react";

import { EffectStack } from "../../src/components/effects/EffectStack";
import {
  EFFECT_HARNESS_SCENARIOS,
  harnessScenario,
  isDevelopmentBuild,
} from "../../src/dev/effectHarness";
import { resolveEffectHarness } from "../../src/dev/effectHarnessEntry";
import { HARNESS_STEP_MS, useEffectHarnessRunner } from "../../src/dev/useEffectHarnessRunner";
import type { GridCell as DomainGridCell } from "../../src/domain/gameTypes";
import { useEventAnimator, type EventAnimator } from "../../src/hooks/useEventAnimator";
import {
  DIAGNOSTICS_REFRESH_MS,
  resetEffectDiagnostics,
} from "../../src/ui/effects/effectDiagnostics";
import { MAX_LIVE_EFFECTS } from "../../src/ui/effects/effectQueue";

/** The device harness for Priority 1.
 *
 *  Everything the multi-effect contract promises is currently proved only by
 *  tests that hand the renderers a hand-built `EffectSequence[]`. That is a
 *  renderer test, not a delivery test: it says nothing about whether the app's
 *  own event stream ever produces six live effects, whether the seventh evicts
 *  the effect the queue's comment claims, or whether a restart mid-sequence
 *  leaves anything behind. Those are precisely the questions a physical device
 *  has to answer, and answering them by playing until the board happens to
 *  produce a double clear plus an explosion is not a procedure.
 *
 *  So the harness drives the SAME pipeline gameplay drives — `useEventAnimator`
 *  fed a turn counter and a `GameEvent[]`, plus `playCue`/`reset` — from a fixed
 *  script. If the harness can make an effect appear, gameplay can too; if it
 *  cannot, the fault is in delivery rather than in the player's luck. */

const EMPTY_GRID: DomainGridCell[][] = Array.from({ length: 8 }, () =>
  Array.from({ length: 8 }, (): DomainGridCell => ({ kind: "empty" })),
);

type RunnerHandle = { run: (id: string) => void; idle: () => boolean };

/** The harness pipeline, with the fallback renderer attached so draw reports are
 *  real rather than simulated. This is the wiring `EffectHarnessScreen` uses;
 *  the screen adds chrome and a board, neither of which changes delivery. */
function Harnessed({
  onAnimator,
  onRunner,
}: {
  onAnimator: (animator: EventAnimator) => void;
  onRunner: (runner: RunnerHandle) => void;
}) {
  // The same wiring the harness screen uses: the cycle between the runner and
  // the animator is broken by a ref written in an effect, never during render.
  const animatorRef = useRef<EventAnimator | null>(null);
  const playCue = useCallback<EventAnimator["playCue"]>((kind, cells) => {
    animatorRef.current?.playCue(kind, cells);
  }, []);
  const reset = useCallback(() => {
    animatorRef.current?.reset();
  }, []);
  const runnerHooks = useMemo(() => ({ playCue, reset }), [playCue, reset]);
  const runner = useEffectHarnessRunner(runnerHooks);
  const animator = useEventAnimator({
    turn: runner.turn,
    events: runner.events,
    grid: EMPTY_GRID,
    reducedMotion: false,
  });
  useEffect(() => {
    animatorRef.current = animator;
    onAnimator(animator);
    onRunner({ run: runner.run, idle: () => runner.idle });
  });

  return (
    <EffectStack
      sequences={animator.sequences}
      cellSize={38}
      reducedMotion={false}
      onStarted={animator.startedDrawing}
    />
  );
}

type Driver = {
  run: (scenarioId: string) => Promise<void>;
  animator: () => EventAnimator;
  unmount: () => Promise<void>;
};

/** Mount the pipeline and expose a scenario runner.
 *
 *  `run` advances the fake clock one step at a time rather than in one jump, so
 *  each scripted step lands in its own task exactly as it does on a device —
 *  which is what makes "six rapid effects" six distinct turns rather than one
 *  batched jump from turn 0 to turn 6. Nothing here advances far enough to reach
 *  a 450ms single-clear retirement, so a scenario always finishes before its effects do. */
async function mountPipeline(): Promise<Driver> {
  let latest: EventAnimator | null = null;
  let handle: RunnerHandle | null = null;
  const view = await render(
    <Harnessed
      onAnimator={(animator) => {
        latest = animator;
      }}
      onRunner={(next) => {
        handle = next;
      }}
    />,
  );

  return {
    run: async (scenarioId: string) => {
      await act(async () => {
        handle!.run(scenarioId);
      });
      for (let guard = 0; guard < 64 && !handle!.idle(); guard += 1) {
        await act(async () => {
          jest.advanceTimersByTime(HARNESS_STEP_MS);
        });
      }
    },
    animator: () => latest!,
    unmount: () => view.unmount(),
  };
}

// Fake timers throughout: the harness schedules its steps, and a frozen clock
// also stops a slow machine letting a 450ms clear retire itself between the
// last step and the assertion.
beforeEach(() => {
  // The ledger is a module singleton, so a counter left behind by one test
  // would be read as delivery by the next.
  resetEffectDiagnostics();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe("the harness catalogue", () => {
  it("covers every situation the device procedure has to reach", () => {
    const ids = EFFECT_HARNESS_SCENARIOS.map((scenario) => scenario.id);

    expect(ids).toEqual([
      "placement",
      "line-clear",
      "double-clear",
      "triple-clear",
      "overload-clear",
      "row-and-column",
      "two-clears",
      "rapid-clear-3",
      "reduced-motion-clear",
      "clear-and-defuse",
      "clear-and-explosion",
      "single-explosion",
      "double-explosion",
      "multi-explosion",
      "explosion-rubble",
      "explosion-rapid-next-turn",
      "reduced-motion-explosion",
      "multiple-explosions",
      "six-rapid",
      "seventh-evicts",
      "critical-under-pressure",
      "retire-lower",
      "restart-mid-effect",
      "session-change",
    ]);
  });

  it("gives every scenario a unique id and a stated expectation", () => {
    const ids = EFFECT_HARNESS_SCENARIOS.map((scenario) => scenario.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const scenario of EFFECT_HARNESS_SCENARIOS) {
      expect(scenario.label.length).toBeGreaterThan(0);
      // The expectation is what a tester compares the phone against. A scenario
      // without one is a button that produces something nobody can fail.
      expect(scenario.expectation.length).toBeGreaterThan(0);
      expect(scenario.steps.length).toBeGreaterThan(0);
    }
  });

  it("looks a scenario up by the id it advertises", () => {
    for (const scenario of EFFECT_HARNESS_SCENARIOS) {
      expect(harnessScenario(scenario.id)).toBe(scenario);
    }
    expect(harnessScenario("no-such-scenario")).toBeUndefined();
  });
});

describe("the harness uses the public pipeline", () => {
  it("reaches effects only through the animator, never through queue or renderer internals", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readFileSync } = require("fs") as {
      readFileSync: (path: string, encoding: string) => string;
    };
    const sources = [
      readFileSync("src/dev/effectHarness.ts", "utf8"),
      readFileSync("src/dev/useEffectHarnessRunner.ts", "utf8"),
      readFileSync("src/dev/EffectHarnessScreen.tsx", "utf8"),
    ].join("\n");

    // Reaching past `useEventAnimator` would make the harness prove only that
    // the harness works. Every one of these is a way to fabricate a live effect
    // without the delivery path gameplay uses.
    for (const forbidden of [
      "admitEffect",
      "retireEffect",
      "startEffect",
      "resetSession",
      "createEffectQueue",
      "assignClockSlots",
      "buildEffectScene",
      "EffectsLayer",
      "CinematicBoardCanvas",
    ]) {
      expect(sources).not.toContain(forbidden);
    }
  });

  it("produces live effects from the same event stream a placement produces", async () => {
    const driver = await mountPipeline();

    await driver.run("line-clear");

    const effects = driver.animator().effects;
    expect(effects).toHaveLength(1);
    expect(effects[0].priority).toBe("high");
    expect(effects[0].plan.rows).toEqual([3]);

    await driver.unmount();
  });

  it("queues nothing for a plain placement, exactly as gameplay does", async () => {
    // A placement with no clear, defuse or explosion has no required sequence,
    // so the queue must stay empty. The harness button still fires the board's
    // placement snap — that beat is a board prop, not a queued effect — and a
    // harness that queued something here would be testing itself.
    const driver = await mountPipeline();

    await driver.run("placement");

    expect(driver.animator().effects).toHaveLength(0);
    expect(driver.animator().isAnimating).toBe(false);

    await driver.unmount();
  });

  it("drives a row and a column clear as one turn, not two", async () => {
    const driver = await mountPipeline();

    await driver.run("row-and-column");

    const effects = driver.animator().effects;
    expect(effects).toHaveLength(1);
    expect(effects[0].plan.rows).toEqual([3]);
    expect(effects[0].plan.columns).toEqual([5]);

    await driver.unmount();
  });

  it("raises a turn carrying an explosion to critical", async () => {
    const driver = await mountPipeline();

    await driver.run("clear-and-explosion");

    const effects = driver.animator().effects;
    expect(effects).toHaveLength(1);
    expect(effects[0].priority).toBe("critical");
    expect(effects[0].plan.explosions).toHaveLength(1);
    expect(effects[0].plan.rubbleCells.length).toBeGreaterThan(0);

    await driver.unmount();
  });

  it("keeps several explosions on one turn individually readable", async () => {
    const driver = await mountPipeline();

    await driver.run("multiple-explosions");

    const [effect] = driver.animator().effects;
    expect(effect.plan.explosions.map((explosion) => explosion.explosionId)).toEqual([
      "harness-x1",
      "harness-x2",
    ]);
    // Each explosion keeps its own rubble; the union is deduplicated.
    expect(effect.plan.explosions.every((explosion) => explosion.cells.length > 0)).toBe(true);

    await driver.unmount();
  });

  it("plays a defuse alongside the clear that produced it", async () => {
    const driver = await mountPipeline();

    await driver.run("clear-and-defuse");

    const [effect] = driver.animator().effects;
    expect(effect.priority).toBe("high");
    expect(effect.plan.defuses).toHaveLength(1);
    expect(effect.plan.rows).toEqual([2]);

    await driver.unmount();
  });

  it("mounts two effects of the same kind as two independent effects", async () => {
    const driver = await mountPipeline();

    await driver.run("two-clears");

    const effects = driver.animator().effects;
    expect(effects.map((effect) => effect.id)).toEqual(["s1:t1", "s1:t2"]);
    expect(new Set(effects.map((effect) => effect.startedAt)).size).toBeGreaterThan(0);

    await driver.unmount();
  });

  it("keeps three rapid clearing turns independently identified and live", async () => {
    const driver = await mountPipeline();

    await driver.run("rapid-clear-3");

    const effects = driver.animator().effects;
    expect(effects.map((effect) => effect.id)).toEqual(["s1:t1", "s1:t2", "s1:t3"]);
    expect(effects.every((effect) => effect.startedAt !== null)).toBe(true);

    await driver.unmount();
  });
});

describe("the harness is absent outside development", () => {
  const original = (globalThis as { __DEV__?: boolean }).__DEV__;

  afterEach(() => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = original;
  });

  it("reports a development build under jest", () => {
    expect(isDevelopmentBuild()).toBe(true);
    expect(resolveEffectHarness()).not.toBeNull();
  });

  it("resolves to nothing in a preview or production build", () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;

    expect(isDevelopmentBuild()).toBe(false);
    // Null rather than a component that renders a message: the point is that no
    // route, no button and no reachable screen exists for a player to find.
    expect(resolveEffectHarness()).toBeNull();
  });

  it("renders nothing from the route when the build is not a development one", async () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;

    // Isolated because the route resolves its component at module scope, the
    // way the renderer flag does — evaluating it fresh is the only way to see
    // the production branch.
    let DevEffectsRoute: ComponentType = () => null;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      DevEffectsRoute = require("../../app/dev-effects").default;
    });
    const view = await render(<DevEffectsRoute />);

    expect(view.toJSON()).toBeNull();
    await view.unmount();
  });

  it("offers no settings entry to the harness outside a development build", async () => {
    // The row is a prop the route supplies only in development, so outside it
    // the button does not exist rather than existing and refusing to work.
    const {
      SettingsView,
    } = // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("../../src/components/SettingsScreen") as typeof import("../../src/components/SettingsScreen");
    const settings = {
      soundEnabled: true,
      musicEnabled: true,
      hapticsEnabled: true,
      reducedMotionOverride: null,
    };

    const withoutEntry = await render(
      <SettingsView
        settings={settings as never}
        onToggle={() => {}}
        onReplayTutorial={() => {}}
        onBack={() => {}}
      />,
    );
    expect(withoutEntry.queryByTestId("settings-effect-harness-button")).toBeNull();
    await withoutEntry.unmount();

    const opened: number[] = [];
    const withEntry = await render(
      <SettingsView
        settings={settings as never}
        onToggle={() => {}}
        onReplayTutorial={() => {}}
        onBack={() => {}}
        onEffectHarness={() => opened.push(1)}
      />,
    );
    expect(withEntry.getByTestId("settings-effect-harness-button")).toBeTruthy();
    await withEntry.unmount();
  });
});

describe("the harness leaves the production bundle", () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const babel = require("@babel/core") as {
    transformSync: (code: string, options: Record<string, unknown>) => { code: string } | null;
  };
  const { inlinePlugin, constantFoldingPlugin } = require("metro-transform-plugins") as {
    inlinePlugin: unknown;
    constantFoldingPlugin: unknown;
  };
  const { readFileSync } = require("fs") as {
    readFileSync: (path: string, encoding: string) => string;
  };
  /* eslint-enable @typescript-eslint/no-require-imports */
  // Named rather than resolved: the repo has no `@types/node`, so
  // `require.resolve` is not typed. Babel resolves it from the project root.
  const typescriptPreset = "@babel/preset-typescript";

  /** Run the two Metro passes that decide whether a `require` survives.
   *
   *  Deliberately NOT a source-pattern match. `docs/DECISIONS.md` already
   *  records a guard that scanned source text certifying two separate broken
   *  blur implementations — a test that checks the shape of the code will always
   *  agree with the code. This one applies the actual transform and asks what
   *  came out, so it is testing the mechanism rather than the spelling. */
  function afterMetroPasses(source: string, dev: boolean): string {
    return (
      babel.transformSync(source, {
        filename: "effectHarnessEntry.ts",
        babelrc: false,
        configFile: false,
        presets: [typescriptPreset],
        plugins: [
          [inlinePlugin, { dev, inlinePlatform: true, isWrapped: false, platform: "android" }],
          constantFoldingPlugin,
        ],
      })?.code ?? ""
    );
  }

  it("drops the harness require from a production transform", () => {
    const source = readFileSync("src/dev/effectHarnessEntry.ts", "utf8");

    // Under a development build the require is reachable, so the harness exists.
    expect(afterMetroPasses(source, true)).toContain("EffectHarnessScreen");
    // Under a production build it is gone, so `collectDependencies` never sees
    // it and the screen — with the catalogue, the runner and the diagnostics
    // overlay behind it — leaves the graph entirely.
    expect(afterMetroPasses(source, false)).not.toContain("EffectHarnessScreen");
  });

  it("can tell the two gates that look right and ship anyway", () => {
    // This is the test's own proof that it means something. Both of these return
    // null correctly in production and pass every behavioural test above; both
    // were written here, and both put the harness in the bundle.

    // A runtime read of `globalThis.__DEV__` is not a constant, so nothing folds.
    const runtimeGate = `
      import { isDevelopmentBuild } from "../config/environment";
      export function resolveEffectHarness() {
        if (!isDevelopmentBuild()) { return null; }
        return require("./EffectHarnessScreen").EffectHarnessScreen;
      }`;
    expect(afterMetroPasses(runtimeGate, false)).toContain("EffectHarnessScreen");

    // The trap: `__DEV__` IS inlined and the `if` DOES fold — to its consequent,
    // leaving the require sitting in the body underneath, still collected.
    const invertedGate = `
      export function resolveEffectHarness() {
        if (!__DEV__) { return null; }
        return require("./EffectHarnessScreen").EffectHarnessScreen;
      }`;
    expect(afterMetroPasses(invertedGate, false)).toContain("EffectHarnessScreen");
  });
});

describe("the harness screen", () => {
  it("includes every deterministic B-06 explosion scenario", () => {
    expect(EFFECT_HARNESS_SCENARIOS.map((scenario) => scenario.id)).toEqual(
      expect.arrayContaining([
        "single-explosion",
        "double-explosion",
        "multi-explosion",
        "explosion-rubble",
        "clear-and-explosion",
        "explosion-rapid-next-turn",
        "reduced-motion-explosion",
      ]),
    );
  });

  it("plays a scenario end to end from its own button", async () => {
    // The screen itself, not the wiring extracted from it: a harness whose
    // buttons are wired to nothing would pass every test above and be useless
    // in the hand.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { EffectHarnessScreen } = require("../../src/dev/EffectHarnessScreen") as {
      EffectHarnessScreen: ComponentType;
    };
    const view = await render(<EffectHarnessScreen />);

    expect(view.getByTestId("effect-harness-expectation")).toHaveTextContent("Pick a scenario.");

    await act(async () => {
      fireEvent.press(view.getByTestId("harness-scenario-line-clear"));
    });
    for (let guard = 0; guard < 8; guard += 1) {
      await act(async () => {
        jest.advanceTimersByTime(HARNESS_STEP_MS);
      });
    }

    // The expectation text is what the tester compares the phone against, and
    // the diagnostics panel is how they tell a missing effect from a refused
    // one. Both have to be on screen for the procedure to be followable.
    expect(view.getByTestId("effect-harness-expectation")).toHaveTextContent(/Row 3 sweeps/);
    expect(view.getByTestId("effect-diagnostics")).toBeTruthy();

    // Past one refresh of the overlay, which polls rather than re-rendering per
    // effect — so the counter lands a beat after the effect does.
    await act(async () => {
      jest.advanceTimersByTime(DIAGNOSTICS_REFRESH_MS);
    });
    expect(view.getByTestId("effect-diagnostics-accepted")).toHaveTextContent("1");

    await view.unmount();
  });

  it("offers a button for every scenario in the catalogue", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { EffectHarnessScreen } = require("../../src/dev/EffectHarnessScreen") as {
      EffectHarnessScreen: ComponentType;
    };
    const view = await render(<EffectHarnessScreen />);

    for (const scenario of EFFECT_HARNESS_SCENARIOS) {
      expect(view.getByTestId(`harness-scenario-${scenario.id}`)).toBeTruthy();
    }

    await view.unmount();
  });
});

describe("the harness reproduces the queue's pressure cases", () => {
  it("holds six effects live at once", async () => {
    const driver = await mountPipeline();

    await driver.run("six-rapid");

    expect(driver.animator().effects).toHaveLength(MAX_LIVE_EFFECTS);
    // All six drew: the renderer reported a start for each, which is the
    // difference between "queued" and "shown".
    expect(driver.animator().effects.every((effect) => effect.startedAt !== null)).toBe(true);

    await driver.unmount();
  });

  it("evicts the oldest effect of the lowest priority when a seventh arrives", async () => {
    const driver = await mountPipeline();

    await driver.run("seventh-evicts");

    const effects = driver.animator().effects;
    expect(effects).toHaveLength(MAX_LIVE_EFFECTS);
    // Turn 1's effect is the victim: same priority as the rest, admitted first.
    expect(effects.map((effect) => effect.id)).toEqual([
      "s1:t2",
      "s1:t3",
      "s1:t4",
      "s1:t5",
      "s1:t6",
      "s1:t7",
    ]);

    await driver.unmount();
  });

  it("keeps a critical effect alive under a burst of ordinary clears", async () => {
    const driver = await mountPipeline();

    await driver.run("critical-under-pressure");

    const effects = driver.animator().effects;
    expect(effects).toHaveLength(MAX_LIVE_EFFECTS);
    // The rewarded cue was admitted FIRST and is the oldest thing in the queue,
    // so a plain "evict the oldest" rule would drop it. It is critical, so it
    // outranks every clear behind it and the oldest clear goes instead.
    const cue = effects.find((effect) => effect.id === "s1:c1");
    expect(cue?.priority).toBe("critical");
    expect(effects.map((effect) => effect.id)).toEqual([
      "s1:c1",
      "s1:t2",
      "s1:t3",
      "s1:t4",
      "s1:t5",
      "s1:t6",
    ]);

    await driver.unmount();
  });
});

describe("the harness exercises retirement and session change", () => {
  it("retires the shorter effect without restarting the survivor", async () => {
    const driver = await mountPipeline();

    await driver.run("retire-lower");

    expect(driver.animator().effects.map((effect) => effect.id)).toEqual(["s1:t1", "s1:c1"]);
    const clearStartedAt = driver
      .animator()
      .effects.find((effect) => effect.id === "s1:t1")?.startedAt;
    expect(clearStartedAt).not.toBeNull();

    // The cue runs 400ms and the polished single clear recovers through 450ms.
    await act(async () => {
      jest.advanceTimersByTime(420);
    });

    const after = driver.animator().effects;
    expect(after.map((effect) => effect.id)).toEqual(["s1:t1"]);
    // An unchanged start time is what "did not restart" means from outside: a
    // survivor that remounted would be re-stamped by a fresh draw report.
    expect(after[0].startedAt).toBe(clearStartedAt);

    await driver.unmount();
  });

  it("clears everything in flight on a restart", async () => {
    const driver = await mountPipeline();

    await driver.run("restart-mid-effect");

    expect(driver.animator().effects).toEqual([]);
    expect(driver.animator().isAnimating).toBe(false);
    expect(driver.animator().sessionId).toBe(2);

    await driver.unmount();
  });

  it("admits the new run's effects under a new generation after a session change", async () => {
    const driver = await mountPipeline();

    await driver.run("session-change");

    const ids = driver.animator().effects.map((effect) => effect.id);
    // Nothing from generation 1 survives, and the new effect carries the new
    // generation in its own id — a stale timer from the old run cannot touch it.
    expect(ids).toHaveLength(1);
    expect(ids[0].startsWith("s2:")).toBe(true);
    expect(driver.animator().sessionId).toBe(2);

    await driver.unmount();
  });
});
