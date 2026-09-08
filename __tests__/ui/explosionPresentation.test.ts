import { createEmptyBoard } from "../../src/domain/board";
import type { GameEvent } from "../../src/domain/events";
import { resolveExpirations } from "../../src/domain/explosions";
import type { ActiveTimedPiece } from "../../src/domain/gameTypes";
import { admitEffect, createEffectQueue, drawOrder } from "../../src/ui/effects/effectQueue";
import { resolvePraiseForTurn } from "../../src/ui/praise";
import { resolveScoreImpactForTurn } from "../../src/ui/scoreImpact";
import { buildEffectPlan, identifyExplosionPresentation } from "../../src/ui/effects/eventEffects";

function explosionEvents(
  blasts: readonly {
    id: string;
    pieceId: string;
    sourceCells: readonly { row: number; column: number }[];
    rubbleCells: readonly { row: number; column: number }[];
  }[],
): GameEvent[] {
  return blasts.flatMap((blast) => [
    {
      type: "explosionStarted",
      explosionId: blast.id,
      pieceId: blast.pieceId,
      sourceCells: [...blast.sourceCells],
    } as unknown as GameEvent,
    { type: "rubbleCreated", explosionId: blast.id, cells: [...blast.rubbleCells] },
  ]);
}

function explosionOf(events: readonly GameEvent[], reducedMotion = false) {
  const plan = buildEffectPlan(events, reducedMotion);
  return { plan, explosion: plan.explosion };
}

describe("B-06 semantic explosion presentation", () => {
  it("derives the blast origin and new rubble only from committed explosion events", () => {
    const { explosion } = explosionOf(
      explosionEvents([
        {
          id: "e-1",
          pieceId: "timed-1",
          sourceCells: [
            { row: 2, column: 2 },
            { row: 2, column: 3 },
          ],
          rubbleCells: [
            { row: 2, column: 2 },
            { row: 2, column: 3 },
            { row: 3, column: 2 },
          ],
        },
      ]),
    );

    expect(explosion).not.toBeNull();
    expect(explosion?.origins).toEqual([{ row: 2, column: 2.5 }]);
    expect(explosion?.sourcePieceIds).toEqual(["timed-1"]);
    expect(explosion?.affectedCells).toEqual([
      { row: 2, column: 2 },
      { row: 2, column: 3 },
      { row: 3, column: 2 },
    ]);
    expect(explosion?.newRubbleCells).toEqual(explosion?.affectedCells);
  });

  it("coordinates simultaneous blasts in one stronger but capped group", () => {
    const { plan, explosion } = explosionOf(
      explosionEvents([
        {
          id: "e-1",
          pieceId: "timed-1",
          sourceCells: [{ row: 1, column: 1 }],
          rubbleCells: [{ row: 1, column: 1 }],
        },
        {
          id: "e-2",
          pieceId: "timed-2",
          sourceCells: [{ row: 6, column: 6 }],
          rubbleCells: [{ row: 6, column: 6 }],
        },
      ]),
    );

    expect(explosion?.simultaneousCount).toBe(2);
    expect(explosion?.magnitude).toBe("double");
    expect(explosion?.origins).toEqual([
      { row: 1, column: 1 },
      { row: 6, column: 6 },
    ]);
    expect(plan.boardImpulse).toEqual({
      source: "explosion",
      amplitudePx: 10,
      durationMs: 420,
    });
    expect(plan.boardImpulse?.amplitudePx).toBeLessThanOrEqual(12);
  });

  it("escalates three or more blasts once, at the 12 px group ceiling", () => {
    const blasts = [1, 3, 5].map((coordinate, index) => ({
      id: `e-${index}`,
      pieceId: `timed-${index}`,
      sourceCells: [{ row: coordinate, column: coordinate }],
      rubbleCells: [{ row: coordinate, column: coordinate }],
    }));
    const { plan, explosion } = explosionOf(explosionEvents(blasts));

    expect(explosion?.magnitude).toBe("multi");
    expect(explosion?.simultaneousCount).toBe(3);
    expect(plan.boardImpulse).toEqual({
      source: "explosion",
      amplitudePx: 12,
      durationMs: 500,
    });
  });

  it("uses the complete five-phase explosion timing instead of the old short burst", () => {
    const { plan, explosion } = explosionOf(
      explosionEvents([
        {
          id: "e-1",
          pieceId: "timed-1",
          sourceCells: [{ row: 3, column: 3 }],
          rubbleCells: [{ row: 3, column: 3 }],
        },
      ]),
    );

    expect(explosion?.timing).toEqual({
      criticalFlashEndMs: 70,
      detonationStartMs: 40,
      detonationEndMs: 180,
      fragmentsStartMs: 120,
      fragmentsEndMs: 450,
      rubbleSettleStartMs: 250,
      rubbleSettleEndMs: 550,
      recoveryStartMs: 500,
      recoveryEndMs: 800,
    });
    expect(plan.durationMs).toBe(800);
    expect(explosion?.bloomIntensity).toBeGreaterThan(1);
    expect(plan.boardImpulse).toEqual({
      source: "explosion",
      amplitudePx: 8,
      durationMs: 350,
    });
  });

  it("deduplicates newly created rubble without hiding distinct blast origins", () => {
    const { explosion } = explosionOf(
      explosionEvents([
        {
          id: "e-1",
          pieceId: "timed-1",
          sourceCells: [{ row: 1, column: 1 }],
          rubbleCells: [
            { row: 1, column: 1 },
            { row: 2, column: 2 },
          ],
        },
        {
          id: "e-2",
          pieceId: "timed-2",
          sourceCells: [{ row: 6, column: 6 }],
          rubbleCells: [
            { row: 2, column: 2 },
            { row: 6, column: 6 },
          ],
        },
      ]),
    );

    expect(explosion?.origins).toHaveLength(2);
    expect(explosion?.newRubbleCells).toEqual([
      { row: 1, column: 1 },
      { row: 2, column: 2 },
      { row: 6, column: 6 },
    ]);
  });

  it("does not replay rubble absent from this turn's rubble-created events", () => {
    const existingRubble = { row: 0, column: 0 };
    const { explosion } = explosionOf(
      explosionEvents([
        {
          id: "e-new",
          pieceId: "timed-new",
          sourceCells: [{ row: 4, column: 4 }],
          rubbleCells: [
            { row: 4, column: 4 },
            { row: 4, column: 5 },
          ],
        },
      ]),
    );

    expect(explosion?.newRubbleCells).not.toContainEqual(existingRubble);
    expect(explosion?.newRubbleCells).toHaveLength(2);
  });

  it("stays above maximum clear hierarchy without changing the committed events", () => {
    const events = explosionEvents([
      {
        id: "e-1",
        pieceId: "timed-1",
        sourceCells: [{ row: 3, column: 3 }],
        rubbleCells: [{ row: 3, column: 3 }],
      },
    ]);
    const snapshot = JSON.parse(JSON.stringify(events)) as GameEvent[];
    const explosionPlan = buildEffectPlan(events, false);
    const overloadPlan = buildEffectPlan(
      [{ type: "linesCleared", rows: [0, 2, 4, 6], columns: [] }],
      false,
    );

    expect(explosionPlan.explosion?.bloomIntensity).toBeGreaterThan(
      overloadPlan.clear?.bloomIntensity ?? 0,
    );
    expect(explosionPlan.boardImpulse?.amplitudePx).toBeGreaterThan(
      overloadPlan.boardImpulse?.amplitudePx ?? 0,
    );
    expect(events).toEqual(snapshot);
  });

  it("binds stable session/turn identity and deterministic presentation fragments", () => {
    const { explosion } = explosionOf(
      explosionEvents([
        {
          id: "e-1",
          pieceId: "timed-1",
          sourceCells: [{ row: 3, column: 3 }],
          rubbleCells: [
            { row: 3, column: 3 },
            { row: 3, column: 4 },
          ],
        },
      ]),
    );
    const once = identifyExplosionPresentation(explosion, "s7:t12", 7, 12);
    const twice = identifyExplosionPresentation(explosion, "s7:t12", 7, 12);

    expect(once).toMatchObject({
      effectId: "s7:t12",
      sessionGeneration: 7,
      turn: 12,
    });
    expect(once?.fragmentSeed).toBe(twice?.fragmentSeed);
    expect(once?.fragments).toEqual(twice?.fragments);
    expect(once?.fragments.length).toBeLessThanOrEqual(24);
  });

  it("exposes the identified contract through the real queue drawing contract", () => {
    const { plan } = explosionOf(
      explosionEvents([
        {
          id: "e-1",
          pieceId: "timed-1",
          sourceCells: [{ row: 1, column: 1 }],
          rubbleCells: [{ row: 1, column: 1 }],
        },
      ]),
    );
    const queue = admitEffect(createEffectQueue(4), {
      id: "s4:t9",
      sessionId: 4,
      turn: 9,
      priority: "critical",
      plan,
      durationMs: plan.durationMs,
    });

    expect(drawOrder(queue)[0].explosion).toMatchObject({
      effectId: "s4:t9",
      sessionGeneration: 4,
      turn: 9,
      simultaneousCount: 1,
    });
  });

  it("emits actual source cells on the domain explosion event", () => {
    const grid = createEmptyBoard();
    grid[4][4] = { kind: "timed", pieceInstanceId: "timed-1", colorId: "amber" };
    grid[4][5] = { kind: "timed", pieceInstanceId: "timed-1", colorId: "amber" };
    const timer: ActiveTimedPiece = {
      id: "timed-1",
      shapeId: "O",
      remainingTurns: 0,
      placedOnTurn: 1,
      colorId: "amber",
    };

    const result = resolveExpirations(grid, { "timed-1": timer }, 123, 9);
    const started = result.events.find((event) => event.type === "explosionStarted");

    expect(started).toMatchObject({
      type: "explosionStarted",
      explosionId: "explosion-9-timed-1",
      pieceId: "timed-1",
      sourceCells: [
        { row: 4, column: 4 },
        { row: 4, column: 5 },
      ],
    });
  });

  it("keeps Reduced Motion readable while removing board shake", () => {
    const { plan, explosion } = explosionOf(
      explosionEvents([
        {
          id: "e-1",
          pieceId: "timed-1",
          sourceCells: [{ row: 2, column: 2 }],
          rubbleCells: [{ row: 2, column: 2 }],
        },
      ]),
      true,
    );

    expect(plan.boardImpulse).toBeNull();
    expect(explosion?.origins).toHaveLength(1);
    expect(explosion?.newRubbleCells).toHaveLength(1);
    expect(plan.durationMs).toBe(180);
  });

  it("keeps clear, praise, and score feedback independent from explosion dominance", () => {
    const events: GameEvent[] = [
      { type: "linesCleared", rows: [0, 1], columns: [] },
      ...explosionEvents([
        {
          id: "e-1",
          pieceId: "timed-1",
          sourceCells: [{ row: 6, column: 6 }],
          rubbleCells: [{ row: 6, column: 6 }],
        },
      ]),
      { type: "scoreChanged", delta: 150, score: 500 },
    ];
    const plan = buildEffectPlan(events, false);

    expect(plan.clear?.lineCount).toBe(2);
    expect(plan.explosion?.simultaneousCount).toBe(1);
    expect(resolvePraiseForTurn(events, { sessionId: 1, turn: 4 })?.text).toBe("DOUBLE");
    expect(resolveScoreImpactForTurn(events, 4)?.delta).toBe(150);
  });
});
