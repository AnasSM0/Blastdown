import {
  admitEffect,
  assignClockSlots,
  createEffectQueue,
  cueEffectId,
  hasRequiredSequence,
  MAX_LIVE_EFFECTS,
  priorityFor,
  resetSession,
  retireEffect,
  retireFinished,
  startEffect,
  turnEffectId,
  type LiveEffect,
} from "../../src/ui/effects/effectQueue";
import type { EffectPlan } from "../../src/ui/effects/eventEffects";

/** The queue exists because effects were intermittently missing on device.
 *
 *  Each describe block below corresponds to one reported or traced failure, so
 *  a regression reads as the symptom rather than as an abstract invariant. */

function plan(overrides: Partial<EffectPlan> = {}): EffectPlan {
  return {
    rows: [],
    columns: [],
    clearedCells: [],
    defuses: [],
    explosion: null,
    explosions: [],
    rubbleCells: [],
    reviveCells: [],
    scoreDelta: 0,
    score: 0,
    combo: null,
    comboReset: false,
    cue: null,
    hasRequiredSequence: false,
    durationMs: 340,
    ...overrides,
    clear: overrides.clear ?? null,
    boardImpulse: overrides.boardImpulse ?? null,
  };
}

function effect(
  id: string,
  overrides: Partial<Omit<LiveEffect, "sequence" | "startedAt">> = {},
): Omit<LiveEffect, "sequence" | "startedAt"> {
  return {
    id,
    sessionId: 1,
    turn: 1,
    priority: "standard",
    plan: plan(),
    durationMs: 340,
    ...overrides,
  };
}

const explosionPlan = plan({
  explosions: [
    {
      explosionId: "e1",
      pieceId: "p1",
      sourceCells: [{ row: 0, column: 0 }],
      origin: { row: 0, column: 0 },
      cells: [{ row: 0, column: 0 }],
    },
  ],
  hasRequiredSequence: true,
});
const clearPlan = plan({ rows: [0], hasRequiredSequence: true });
const cuePlan = plan({ cue: "revive", reviveCells: [{ row: 1, column: 1 }] });

describe("simultaneous effects are not lost", () => {
  it("holds a clear, a defuse and an explosion from one turn at once", () => {
    // The old renderer held ONE plan. A turn that cleared a line, defused a
    // piece and exploded another showed whichever arrived last.
    let queue = createEffectQueue();
    queue = admitEffect(queue, effect("clear", { priority: "high", plan: clearPlan }));
    queue = admitEffect(queue, effect("defuse", { priority: "high" }));
    queue = admitEffect(queue, effect("boom", { priority: "critical", plan: explosionPlan }));

    expect(queue.effects.map((e) => e.id)).toEqual(["clear", "defuse", "boom"]);
  });

  it("keeps a rewarded cue that arrives while a turn sequence is playing", () => {
    // The exact bug: `playCue` returned early when the animator was busy, so a
    // rewarded defuse bought with an ad produced no feedback at all.
    let queue = createEffectQueue();
    queue = admitEffect(queue, effect("turn", { priority: "high", plan: clearPlan }));
    queue = admitEffect(queue, effect("cue", { priority: "critical", plan: cuePlan }));

    expect(queue.effects).toHaveLength(2);
    expect(queue.effects.map((e) => e.id)).toContain("cue");
  });

  it("keeps a turn sequence that arrives while a cue is playing", () => {
    let queue = createEffectQueue();
    queue = admitEffect(queue, effect("cue", { priority: "critical", plan: cuePlan }));
    queue = admitEffect(queue, effect("turn", { priority: "high", plan: clearPlan }));

    expect(queue.effects).toHaveLength(2);
  });
});

describe("identity", () => {
  it("gives two effects from the same turn different ids", () => {
    expect(turnEffectId(1, 5)).not.toBe(cueEffectId(1, 5));
  });

  it("gives the same turn in two runs different ids", () => {
    // Without the session in the id, a restart's turn 1 would look like a
    // duplicate of the previous run's turn 1 and be silently refused.
    expect(turnEffectId(1, 1)).not.toBe(turnEffectId(2, 1));
  });

  it("gives consecutive cues different ids", () => {
    expect(cueEffectId(1, 1)).not.toBe(cueEffectId(1, 2));
  });

  it("refuses a duplicate rather than restarting the running effect", () => {
    // A re-render re-running the admit path is normal. Admitting twice is how
    // an effect used to restart from zero half way through playing.
    let queue = createEffectQueue();
    queue = admitEffect(queue, effect("t1"));
    queue = startEffect(queue, "t1", 1000);
    const before = queue.effects[0];

    queue = admitEffect(queue, effect("t1"));

    expect(queue.effects).toHaveLength(1);
    expect(queue.effects[0]).toBe(before);
    expect(queue.effects[0].startedAt).toBe(1000);
  });
});

describe("the renderer owns the start time", () => {
  it("admits with no start time at all", () => {
    const queue = admitEffect(createEffectQueue(), effect("t1"));

    expect(queue.effects[0].startedAt).toBeNull();
  });

  it("begins at progress zero however late it is first drawn", () => {
    // The reliability fix in one test. An effect admitted during a stalled
    // frame and first drawn 400ms later must still play its whole lifecycle;
    // stamping admission time would have it begin already finished.
    let queue = admitEffect(createEffectQueue(), effect("t1", { durationMs: 340 }));

    queue = startEffect(queue, "t1", 400);

    expect(queue.effects[0].startedAt).toBe(400);
    expect(retireFinished(queue, 400).effects).toHaveLength(1);
    expect(retireFinished(queue, 739).effects).toHaveLength(1);
    expect(retireFinished(queue, 740).effects).toHaveLength(0);
  });

  it("ignores a second start, so a re-render cannot replay it", () => {
    // A theme switch, a resize or a reduced-motion toggle mid-sequence used to
    // rebuild the effect scene and restart the clock.
    let queue = admitEffect(createEffectQueue(), effect("t1"));
    queue = startEffect(queue, "t1", 100);
    queue = startEffect(queue, "t1", 5000);

    expect(queue.effects[0].startedAt).toBe(100);
  });

  it("never retires an effect that has not been drawn yet", () => {
    // A frame the app spent stalled must not silently eat the effect.
    const queue = admitEffect(createEffectQueue(), effect("t1", { durationMs: 100 }));

    expect(retireFinished(queue, 999_999).effects).toHaveLength(1);
  });
});

describe("the queue is bounded and evicts deterministically", () => {
  it("never exceeds the cap", () => {
    let queue = createEffectQueue();
    for (let index = 0; index < MAX_LIVE_EFFECTS * 3; index++) {
      queue = admitEffect(queue, effect(`e${index}`));
    }

    expect(queue.effects.length).toBe(MAX_LIVE_EFFECTS);
  });

  it("drops commentary before it drops an explosion", () => {
    // The rule that matters: an explosion permanently rubbles the board, so the
    // player has to see it. Score floats are opinions.
    let queue = createEffectQueue();
    queue = admitEffect(queue, effect("boom", { priority: "critical", plan: explosionPlan }));
    for (let index = 0; index < MAX_LIVE_EFFECTS * 2; index++) {
      queue = admitEffect(queue, effect(`chatter${index}`, { priority: "standard" }));
    }

    expect(queue.effects.map((e) => e.id)).toContain("boom");
  });

  it("evicts the oldest among equals, so bursts drain in order", () => {
    let queue = createEffectQueue();
    for (let index = 0; index < MAX_LIVE_EFFECTS; index++) {
      queue = admitEffect(queue, effect(`e${index}`));
    }
    queue = admitEffect(queue, effect("newest"));

    expect(queue.effects.map((e) => e.id)).not.toContain("e0");
    expect(queue.effects.map((e) => e.id)).toContain("newest");
  });

  it("admits a new critical into a full queue of commentary", () => {
    // The case that matters for feel: the player just caused something
    // irreversible, and a backlog of score floats must not be the reason they
    // do not see it.
    let queue = createEffectQueue();
    for (let index = 0; index < MAX_LIVE_EFFECTS; index++) {
      queue = admitEffect(queue, effect(`chatter${index}`, { priority: "standard" }));
    }
    queue = admitEffect(queue, effect("boom", { priority: "critical", plan: explosionPlan }));

    expect(queue.effects.map((e) => e.id)).toContain("boom");
    expect(queue.effects).toHaveLength(MAX_LIVE_EFFECTS);
  });

  it("refuses new commentary when the queue is full of things that matter more", () => {
    // The complement, and the one that looks like a bug until you name it. Six
    // live criticals means six explosions or bought rewards on screen at once.
    // Dropping one of those to show a score float would be the wrong trade, so
    // the float is what goes -- even though it is the newest.
    let queue = createEffectQueue();
    for (let index = 0; index < MAX_LIVE_EFFECTS; index++) {
      queue = admitEffect(queue, effect(`boom${index}`, { priority: "critical" }));
    }
    queue = admitEffect(queue, effect("float", { priority: "standard" }));

    expect(queue.effects.map((e) => e.id)).not.toContain("float");
    expect(queue.effects).toHaveLength(MAX_LIVE_EFFECTS);
  });

  it("evicts identically for identical input", () => {
    const build = () => {
      let queue = createEffectQueue();
      for (let index = 0; index < MAX_LIVE_EFFECTS * 2; index++) {
        queue = admitEffect(
          queue,
          effect(`e${index}`, { priority: index % 3 === 0 ? "critical" : "standard" }),
        );
      }
      return queue.effects.map((e) => e.id);
    };

    expect(build()).toEqual(build());
  });
});

describe("cleanup happens exactly once, and only for this run", () => {
  it("retires a finished effect once and then leaves the queue alone", () => {
    let queue = admitEffect(createEffectQueue(), effect("t1", { durationMs: 100 }));
    queue = startEffect(queue, "t1", 0);

    const retired = retireFinished(queue, 200);
    expect(retired.effects).toHaveLength(0);
    // Idempotent: a second sweep is a no-op and returns the same object, so it
    // cannot cause another render.
    expect(retireFinished(retired, 300)).toBe(retired);
  });

  it("drops everything on a session reset", () => {
    let queue = createEffectQueue();
    queue = admitEffect(queue, effect("boom", { priority: "critical", plan: explosionPlan }));
    queue = startEffect(queue, "boom", 0);

    queue = resetSession(queue);

    expect(queue.effects).toHaveLength(0);
  });

  it("refuses effects still being scheduled for the run that just ended", () => {
    // Restart, Home and unmount all end a generation. Anything in flight for
    // the old run is refused by value rather than raced against by a cleanup.
    let queue = createEffectQueue();
    const stale = effect("late", { sessionId: queue.sessionId });
    queue = resetSession(queue);

    queue = admitEffect(queue, stale);

    expect(queue.effects).toHaveLength(0);
  });

  it("accepts the new run's effects immediately after a reset", () => {
    let queue = resetSession(createEffectQueue());
    queue = admitEffect(queue, effect("fresh", { sessionId: queue.sessionId }));

    expect(queue.effects).toHaveLength(1);
  });

  it("removes a named effect once", () => {
    let queue = admitEffect(createEffectQueue(), effect("t1"));
    queue = retireEffect(queue, "t1");

    expect(queue.effects).toHaveLength(0);
    expect(retireEffect(queue, "t1")).toBe(queue);
  });
});

describe("required-sequence observation follows the queue", () => {
  it("reports while any required sequence is live", () => {
    const queue = admitEffect(createEffectQueue(), effect("clear", { plan: clearPlan }));

    expect(hasRequiredSequence(queue)).toBe(true);
  });

  it("does not report a cue as a required turn sequence", () => {
    const queue = admitEffect(createEffectQueue(), effect("cue", { plan: cuePlan }));

    expect(hasRequiredSequence(queue)).toBe(false);
  });

  it("reports an effect that has not been drawn yet", () => {
    const queue = admitEffect(createEffectQueue(), effect("clear", { plan: clearPlan }));

    expect(queue.effects[0].startedAt).toBeNull();
    expect(hasRequiredSequence(queue)).toBe(true);
  });

  it("clears once everything has retired", () => {
    let queue = admitEffect(createEffectQueue(), effect("clear", { plan: clearPlan }));
    queue = startEffect(queue, "clear", 0);
    queue = retireFinished(queue, 1000);

    expect(hasRequiredSequence(queue)).toBe(false);
  });
});

describe("priority is derived from what actually happened", () => {
  it("treats an explosion as critical, because the board is permanently damaged", () => {
    expect(priorityFor(explosionPlan)).toBe("critical");
  });

  it("treats a rewarded cue as critical, because the player paid for it", () => {
    expect(priorityFor(cuePlan)).toBe("critical");
  });

  it("treats a clear and a defuse as high", () => {
    expect(priorityFor(clearPlan)).toBe("high");
    expect(priorityFor(plan({ defuses: [{ pieceId: "p", bonus: 25, cells: [] }] }))).toBe("high");
  });

  it("treats bare score commentary as standard", () => {
    expect(priorityFor(plan({ scoreDelta: 12 }))).toBe("standard");
  });
});

describe("clock slots are leased by effect id", () => {
  const seq = (id: string, priority: "standard" | "high" | "critical") => ({
    id,
    sessionGeneration: 1,
    turn: 1,
    priority,
    plan: {} as never,
    explosion: null,
  });

  it("keeps a survivor's slot when a neighbour before it retires", () => {
    // The regression that position-based slots caused. Draw order is a sort, so
    // retiring the standard effect moves the critical one from index 1 to index
    // 0. Under index-assigned clocks it would find a different clock, read as a
    // new effect, and restart from zero mid-flight.
    const leases = new Map<string, number>();
    const both = [seq("a", "standard"), seq("b", "critical")];
    const first = assignClockSlots(leases, both, MAX_LIVE_EFFECTS);
    const bSlot = first.find((entry) => entry.sequence.id === "b")?.slot;

    const after = assignClockSlots(leases, [both[1]], MAX_LIVE_EFFECTS);

    expect(after).toHaveLength(1);
    expect(after[0].slot).toBe(bSlot);
  });

  it("keeps existing slots when a higher-priority effect is admitted", () => {
    // Admitting a critical effect re-sorts the list, pushing the standard one
    // down. Its clock must not move with it.
    const leases = new Map<string, number>();
    const before = assignClockSlots(leases, [seq("a", "standard")], MAX_LIVE_EFFECTS);
    const after = assignClockSlots(
      leases,
      [seq("a", "standard"), seq("b", "critical")],
      MAX_LIVE_EFFECTS,
    );

    expect(after.find((entry) => entry.sequence.id === "a")?.slot).toBe(before[0].slot);
  });

  it("reuses a freed slot rather than running out", () => {
    const leases = new Map<string, number>();
    const filled = Array.from({ length: MAX_LIVE_EFFECTS }, (_, index) => seq(`e${index}`, "high"));
    assignClockSlots(leases, filled, MAX_LIVE_EFFECTS);
    const freed = leases.get("e0");

    const next = assignClockSlots(
      leases,
      [...filled.slice(1), seq("new", "high")],
      MAX_LIVE_EFFECTS,
    );

    expect(next).toHaveLength(MAX_LIVE_EFFECTS);
    expect(next.find((entry) => entry.sequence.id === "new")?.slot).toBe(freed);
  });

  it("gives every live effect a distinct slot", () => {
    const leases = new Map<string, number>();
    const assigned = assignClockSlots(
      leases,
      Array.from({ length: MAX_LIVE_EFFECTS }, (_, index) => seq(`e${index}`, "high")),
      MAX_LIVE_EFFECTS,
    );
    expect(new Set(assigned.map((entry) => entry.slot)).size).toBe(MAX_LIVE_EFFECTS);
  });
});
