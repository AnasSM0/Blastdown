import { sceneGeometry } from "../../src/rendering/cinematic/geometry";
import { cinematicPalette } from "../../src/rendering/cinematic/palette";
import { buildEffectScene } from "../../src/rendering/cinematic/effects/effectScene";
import {
  buildEffectPlan,
  MAX_BURST_CELLS,
  type EffectPlan,
} from "../../src/ui/effects/eventEffects";
import { resolveTheme } from "../../src/ui/themes";

/** The effect model decides what plays; the canvas only advances a clock over
 *  it. So everything worth asserting about effects is asserted here, and the
 *  canvas is left with nothing it could get wrong that a device would not show
 *  immediately.
 *
 *  Two themes run through these tests. Effects must be BOUNDED, because several
 *  pieces can expire on one turn and an uncapped cascade is how a puzzle game
 *  drops frames at exactly its most dramatic moment. And they must REPORT rather
 *  than decide: every primitive is anchored on cells the engine already
 *  committed, which is what makes dropping one safe. */

const geometry = sceneGeometry(328, 8);
const palette = cinematicPalette(resolveTheme(undefined));

function plan(overrides: Partial<EffectPlan> = {}, reducedMotion = false): EffectPlan {
  const rows = overrides.rows ?? [];
  const columns = overrides.columns ?? [];
  const generated = buildEffectPlan(
    rows.length > 0 || columns.length > 0
      ? [{ type: "linesCleared", rows: [...rows], columns: [...columns] }]
      : [],
    reducedMotion,
  );
  const explosionImpulse =
    (overrides.explosions?.length ?? 0) > 0 && !reducedMotion
      ? { source: "explosion" as const, amplitudePx: 8, durationMs: 200 }
      : generated.boardImpulse;
  return {
    rows: [],
    columns: [],
    clearedCells: [],
    defuses: [],
    explosions: [],
    rubbleCells: [],
    reviveCells: [],
    scoreDelta: 0,
    score: 0,
    combo: null,
    comboReset: false,
    cue: null,
    hasRequiredSequence: false,
    ...overrides,
    clear: overrides.clear ?? generated.clear,
    boardImpulse: overrides.boardImpulse ?? explosionImpulse,
    durationMs: overrides.durationMs ?? (generated.durationMs > 0 ? generated.durationMs : 340),
  };
}

function cells(count: number, row = 0) {
  return Array.from({ length: count }, (_, column) => ({ row, column }));
}

describe("line clears", () => {
  const clearing = plan({ rows: [3], clearedCells: cells(8, 3) });

  it("sweeps the lane and flashes every cleared cell", () => {
    const scene = buildEffectScene(clearing, geometry, palette, false);

    expect(scene.sweeps).toHaveLength(1);
    expect(scene.sweeps[0].orientation).toBe("row");
    expect(scene.flashes).toHaveLength(8);
  });

  it("staggers along the row, and caps the stagger so a full line still feels immediate", () => {
    const scene = buildEffectScene(clearing, geometry, palette, false);
    const delays = scene.flashes.map((flash) => (flash.clearTimeline?.releaseStartMs ?? 0) - 220);

    expect(delays[0]).toBe(0);
    expect(delays[7]).toBeGreaterThan(delays[0]);
    // Without the cap, a wider board would make the last cell of a clear lag
    // noticeably behind the first, and the beat would read as lag rather than
    // as direction.
    expect(Math.max(...delays)).toBeLessThanOrEqual(56);
  });

  it("gives an intersection the earlier of its two lanes, not both flashes", () => {
    // A cell in both a cleared row and a cleared column belongs to two sweeps.
    // Flashing it twice would double its brightness; taking the later delay
    // would make it lag its own row. It takes the earlier.
    const scene = buildEffectScene(
      plan({ rows: [0], columns: [7], clearedCells: [{ row: 0, column: 7 }] }),
      geometry,
      palette,
      false,
    );

    expect(scene.flashes).toHaveLength(15);
    expect(scene.flashes.filter((flash) => flash.key === "clear-0-7")).toHaveLength(1);
  });
});

describe("expiry bursts stay within budget", () => {
  it("caps debris across every explosion in the turn, not per explosion", () => {
    // Four pieces expiring at once is a legal turn. Capping per explosion would
    // let four legal explosions multiply past the budget; the cap is shared.
    const explosions = Array.from({ length: 4 }, (_, index) => ({
      explosionId: `e${index}`,
      pieceId: `p${index}`,
      cells: cells(10, index),
    }));

    const scene = buildEffectScene(plan({ explosions }), geometry, palette, false);

    expect(scene.bursts.length).toBeLessThanOrEqual(MAX_BURST_CELLS);
    // And it really did have more to draw than it drew.
    expect(scene.bursts).toHaveLength(MAX_BURST_CELLS);
  });

  it("throws debris deterministically, so a repeat looks like the same explosion", () => {
    const once = buildEffectScene(
      plan({ explosions: [{ explosionId: "e", pieceId: "p", cells: cells(4) }] }),
      geometry,
      palette,
      false,
    );
    const twice = buildEffectScene(
      plan({ explosions: [{ explosionId: "e", pieceId: "p", cells: cells(4) }] }),
      geometry,
      palette,
      false,
    );

    expect(once.bursts.map((b) => b.angle)).toEqual(twice.bursts.map((b) => b.angle));
  });

  it("shakes the board once for an explosion turn and never otherwise", () => {
    expect(
      buildEffectScene(
        plan({ explosions: [{ explosionId: "e", pieceId: "p", cells: cells(1) }] }),
        geometry,
        palette,
        false,
      ).shake,
    ).toBeGreaterThan(0);
    expect(buildEffectScene(plan({ rows: [0] }), geometry, palette, false).shake).toBe(0);
  });
});

describe("defuse is contained to its own piece", () => {
  it("flashes the piece's cells and rings their centroid", () => {
    const scene = buildEffectScene(
      plan({
        defuses: [
          {
            pieceId: "p1",
            bonus: 45,
            cells: [
              { row: 2, column: 2 },
              { row: 2, column: 3 },
            ],
          },
        ],
      }),
      geometry,
      palette,
      false,
    );

    expect(scene.flashes).toHaveLength(2);
    expect(scene.rings).toHaveLength(1);
    // The ring sits between the two cells, not on either one.
    const left = scene.flashes[0].rect;
    const right = scene.flashes[1].rect;
    expect(scene.rings[0].center.x).toBeGreaterThan(left.x);
    expect(scene.rings[0].center.x).toBeLessThan(right.x + right.width);
  });

  it("never sweeps the board for a defuse", () => {
    const scene = buildEffectScene(
      plan({ defuses: [{ pieceId: "p1", bonus: 25, cells: [{ row: 0, column: 0 }] }] }),
      geometry,
      palette,
      false,
    );

    expect(scene.sweeps).toEqual([]);
  });
});

describe("reduced motion removes movement, not meaning", () => {
  const busyOverrides: Partial<EffectPlan> = {
    rows: [0],
    clearedCells: cells(8),
    explosions: [{ explosionId: "e", pieceId: "p", cells: cells(3, 4) }],
    reviveCells: cells(2, 6),
    scoreDelta: 150,
    defuses: [{ pieceId: "p1", bonus: 25, cells: [{ row: 1, column: 1 }] }],
  };
  const busy = plan(busyOverrides);

  it("still reports every event", () => {
    const reduced = buildEffectScene(plan(busyOverrides, true), geometry, palette, true);

    // `docs/ACCESSIBILITY.md`: a cleared line still flashes, expiry still shows
    // its rubble, a defuse still pulses, a revive still reads as restoration.
    // Removing the signal — rather than the movement — would make the board
    // less legible for the players the setting exists to help.
    expect(reduced.flashes.length).toBeGreaterThan(0);
    expect(reduced.bursts.length).toBeGreaterThan(0);
    expect(reduced.rings.length).toBeGreaterThan(0);
    expect(reduced.texts.length).toBeGreaterThan(0);
  });

  it("drops travelling sweeps, staggers, debris throw, text rise and shake", () => {
    const reduced = buildEffectScene(plan(busyOverrides, true), geometry, palette, true);

    expect(reduced.sweeps).toEqual([]);
    expect(reduced.shake).toBe(0);
    expect(reduced.flashes.every((f) => f.delayMs === 0)).toBe(true);
    expect(reduced.flashes.every((f) => !f.settles)).toBe(true);
    expect(reduced.bursts.every((b) => b.distance === 0)).toBe(true);
    expect(reduced.texts.every((t) => t.riseBy === 0)).toBe(true);
  });

  it("shortens each beat, because a static emphasis that lingers reads as a stall", () => {
    const reduced = buildEffectScene(plan(busyOverrides, true), geometry, palette, true);
    const full = buildEffectScene(busy, geometry, palette, false);

    expect(Math.max(...reduced.flashes.map((f) => f.durationMs))).toBeLessThan(
      Math.max(...full.flashes.map((f) => f.durationMs)),
    );
  });
});

describe("the score readout", () => {
  it("anchors on the event rather than the middle of the board", () => {
    // Centring it would put the number over cells the player is about to place
    // into, on exactly the turn they are looking there.
    const scene = buildEffectScene(
      plan({ rows: [7], clearedCells: cells(8, 7), scoreDelta: 100 }),
      geometry,
      palette,
      false,
    );

    expect(scene.texts[0].text).toBe("+100");
    expect(scene.texts[0].center.y).toBeGreaterThan(geometry.boardSide / 2);
  });

  it("says nothing when nothing was scored", () => {
    expect(buildEffectScene(plan({ rows: [0] }), geometry, palette, false).texts).toEqual([]);
  });
});

describe("an unmeasured board draws nothing", () => {
  it("returns an empty scene rather than primitives at zero size", () => {
    const scene = buildEffectScene(
      plan({ rows: [0], clearedCells: cells(8) }),
      sceneGeometry(0, 8),
      palette,
      false,
    );

    expect(scene).toEqual({
      sweeps: [],
      blooms: [],
      flashes: [],
      rings: [],
      bursts: [],
      texts: [],
      shake: 0,
      shakeDurationMs: 0,
      durationMs: 0,
    });
  });
});

describe("every primitive carries a stable, unique key", () => {
  it("so the canvas can mount one child per primitive without collisions", () => {
    const scene = buildEffectScene(
      plan({
        rows: [0],
        columns: [0],
        clearedCells: [...cells(8), { row: 1, column: 0 }],
        explosions: [{ explosionId: "e", pieceId: "p", cells: cells(3, 5) }],
        reviveCells: cells(2, 6),
        scoreDelta: 50,
      }),
      geometry,
      palette,
      false,
    );

    const keys = [
      ...scene.sweeps.map((p) => p.key),
      ...scene.blooms.map((p) => p.key),
      ...scene.flashes.map((p) => p.key),
      ...scene.rings.map((p) => p.key),
      ...scene.bursts.map((p) => p.key),
      ...scene.texts.map((p) => p.key),
    ];

    expect(new Set(keys).size).toBe(keys.length);
  });
});
