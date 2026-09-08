import { renderHook } from "@testing-library/react-native";

import { buildEffectScene } from "../../src/rendering/cinematic/effects/effectScene";
import { useBloomPaint } from "../../src/rendering/cinematic/layers/BlocksLayer";
import { sceneGeometry } from "../../src/rendering/cinematic/geometry";
import { cinematicPalette } from "../../src/rendering/cinematic/palette";
import { resolveTheme } from "../../src/ui/themes";
import { buildEffectPlan, type EffectPlan } from "../../src/ui/effects/eventEffects";
import type { RecordedPaint } from "../../test-utils/skiaMock";

/** GPU and UI-thread budget guards.
 *
 *  These exist because the first version of this renderer shipped a specific,
 *  measurable mistake: a `BlurMask` on every block and every clear flash. A blur
 *  mask is an offscreen render pass, so a full-board line clear asked a
 *  mid-range Android GPU for well over a hundred of them in a single frame. The
 *  code looked reasonable, every test was green, and the only symptom was that
 *  gameplay felt laggy.
 *
 *  Nothing here measures anything — no timing assertion under jest would mean
 *  anything about a phone. What these pin is the STRUCTURE: how many blur masks
 *  the source can produce, and how many animated primitives a worst-case turn
 *  can mount. Both are things a future change could quietly multiply, and both
 *  are invisible without a device. */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { readFileSync, readdirSync, statSync } = require("fs") as {
  readFileSync: (path: string, encoding: string) => string;
  readdirSync: (path: string) => string[];
  statSync: (path: string) => { isDirectory: () => boolean };
};

/** Source with comments removed.
 *
 *  These files explain at length WHY the blur rule exists, and those
 *  explanations quote the very syntax being banned. Scanning raw text made the
 *  guard fire on its own documentation — so the comments come out first, and
 *  the guard reads only code. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** Run a hook and hand back its value.
 *
 *  `useBloomPaint` is a hook, so it needs a render to run — and running it for
 *  real is the point: the paint under test is the one the renderer will build. */
async function renderHookResult<T>(hook: () => T): Promise<T> {
  // RNTL 14 is fully async — renderHook returns a promise wrapping its own
  // act(). Awaiting it is not optional; a synchronous read gets undefined.
  const { result } = await renderHook(hook);
  return result.current;
}

function layerSources(): { file: string; source: string }[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const path = `${dir}/${entry}`;
      return statSync(path).isDirectory() ? walk(path) : path.endsWith(".tsx") ? [path] : [];
    });
  return walk("src/rendering/cinematic").map((file) => ({
    file,
    source: stripComments(readFileSync(file, "utf8")),
  }));
}

describe("blur is applied once, not once per cell", () => {
  /** This guard has now been wrong twice, and both failures were the same
   *  mistake: it checked what the SOURCE looked like instead of what the paint
   *  would do.
   *
   *  Version one counted `<BlurMask>` elements per file and passed when a layer
   *  had one. But a mask filter declared inside a `<Group>` becomes part of that
   *  group's paint and every child draws with it, so one element in the source
   *  was still one blurred draw per cell. The test certified a fix that had not
   *  happened.
   *
   *  Version two asserted the source contained `Skia.MaskFilter.MakeBlur` and
   *  `<Group layer={...}>`. Both were present, and the combination does
   *  nothing: Skia composites a `saveLayer` using only the paint's alpha,
   *  colour filter, IMAGE filter and blend mode. A mask filter is ignored at
   *  restore. That version paid for an offscreen surface and drew crisp halos —
   *  worse than the bug it replaced — and the test said it was correct.
   *
   *  So this version asks the paint. `useBloomPaint` is called for real and the
   *  resulting paint is inspected: it must carry an image filter, and it must
   *  not carry a mask filter. That is the distinction that decides whether the
   *  bloom exists at all, and it is checkable without a device. */

  it("gives the bloom paint an image filter, which survives a layer composite", async () => {
    const paint = (await renderHookResult(() => useBloomPaint(6))) as RecordedPaint | undefined;

    expect(paint).toBeDefined();
    expect(paint!.imageFilter).toMatchObject({ __imageFilter: true });
  });

  it("gives the bloom paint no mask filter, which would not", async () => {
    // The whole failure of the previous attempt, in one assertion.
    const paint = (await renderHookResult(() => useBloomPaint(6))) as RecordedPaint | undefined;

    expect(paint!.maskFilter).toBeNull();
  });

  it("blurs both axes by the requested radius", async () => {
    const paint = (await renderHookResult(() => useBloomPaint(9))) as RecordedPaint | undefined;

    expect(paint!.imageFilter).toMatchObject({ sigmaX: 9, sigmaY: 9 });
  });

  it("builds no paint at all when the theme has no glow", async () => {
    // A zero-glow theme should not pay for a saveLayer to blur nothing.
    expect(await renderHookResult(() => useBloomPaint(0))).toBeUndefined();
  });

  it("uses no declarative BlurMask anywhere in the canvas layers", () => {
    // The declarative element cannot express a single pass over many shapes:
    // wherever it sits, it ends up on a paint that each child draws with.
    const offenders = layerSources()
      .filter(({ source }) => /<BlurMask/.test(source))
      .map(({ file }) => file);

    expect(offenders).toEqual([]);
  });

  it("draws effect primitives with no blur at all", () => {
    // Effects are the uncapped-in-principle ones: one flash per cleared cell,
    // one ring per defused piece. Any blur on those scales with the turn.
    const source = stripComments(
      readFileSync("src/rendering/cinematic/layers/EffectsLayer.tsx", "utf8"),
    );

    expect(source).not.toMatch(/BlurMask/);
    expect(source).not.toMatch(/MakeBlur/);
  });
});

describe("the effect model caps what a turn can mount", () => {
  const geometry = sceneGeometry(328, 8);
  const palette = cinematicPalette(resolveTheme(undefined));

  function plan(overrides: Partial<EffectPlan> = {}): EffectPlan {
    const rows = overrides.rows ?? [];
    const columns = overrides.columns ?? [];
    const generated = buildEffectPlan(
      rows.length > 0 || columns.length > 0
        ? [{ type: "linesCleared", rows: [...rows], columns: [...columns] }]
        : [],
      false,
    );
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
      durationMs: 780,
      ...overrides,
      clear: overrides.clear ?? generated.clear,
      boardImpulse: overrides.boardImpulse ?? generated.boardImpulse,
    };
  }

  it("caps sweeps even if the plan reports impossible rows and columns", () => {
    // Authoritative play cannot clear 40 rows on an 8x8 board. The renderer
    // should not depend on that: a duplicated event must not mount 40 animated
    // components on the busiest frame of the turn.
    const scene = buildEffectScene(
      plan({
        rows: Array.from({ length: 40 }, (_, i) => i),
        columns: Array.from({ length: 40 }, (_, i) => i),
      }),
      geometry,
      palette,
      false,
    );

    expect(scene.sweeps.length).toBeLessThanOrEqual(16);
  });

  it("caps defuse flashes and rings", () => {
    const scene = buildEffectScene(
      plan({
        defuses: Array.from({ length: 80 }, (_, i) => ({
          pieceId: `p${i}`,
          bonus: 25,
          cells: [{ row: i % 8, column: Math.floor(i / 8) % 8 }],
        })),
      }),
      geometry,
      palette,
      false,
    );

    expect(scene.rings.length).toBeLessThanOrEqual(16);
    expect(scene.flashes.length).toBeLessThanOrEqual(128);
  });

  it("stops walking explosion cells once the debris budget is spent", () => {
    // The budget used to be enforced with `return` inside a forEach callback,
    // which skips one cell rather than stopping the traversal — so an exhausted
    // budget still walked every remaining cell of every remaining explosion.
    // A large plan finishing quickly is the observable form of that fix.
    const huge = plan({
      explosions: Array.from({ length: 200 }, (_, index) => ({
        explosionId: `e${index}`,
        pieceId: `p${index}`,
        cells: Array.from({ length: 64 }, (_, c) => ({ row: c % 8, column: Math.floor(c / 8) })),
      })),
    });

    const started = Date.now();
    const scene = buildEffectScene(huge, geometry, palette, false);

    expect(scene.bursts.length).toBe(24);
    // 200 x 64 = 12,800 cells offered against a 24 budget. This is generous
    // enough not to be flaky and still far below what a full traversal costs.
    expect(Date.now() - started).toBeLessThan(200);
  });

  it("keeps the worst realistic turn's animated primitive count bounded", () => {
    // A full board clearing every row and column, with defuses and explosions.
    // Each primitive mounts a component owning one or two derived values on the
    // UI thread, so this number is the real ceiling on per-frame worklet work.
    const worst = plan({
      rows: [0, 1, 2, 3, 4, 5, 6, 7],
      columns: [0, 1, 2, 3, 4, 5, 6, 7],
      clearedCells: Array.from({ length: 64 }, (_, i) => ({
        row: Math.floor(i / 8),
        column: i % 8,
      })),
      defuses: Array.from({ length: 8 }, (_, i) => ({
        pieceId: `p${i}`,
        bonus: 25,
        cells: [{ row: i, column: 0 }],
      })),
      explosions: [
        {
          explosionId: "e",
          pieceId: "x",
          cells: Array.from({ length: 30 }, (_, c) => ({ row: c % 8, column: Math.floor(c / 8) })),
        },
      ],
      scoreDelta: 900,
    });

    const scene = buildEffectScene(worst, geometry, palette, false);
    const total =
      scene.sweeps.length +
      scene.flashes.length +
      scene.rings.length +
      scene.bursts.length +
      scene.texts.length;

    expect(total).toBeLessThanOrEqual(160);
  });

  it("mounts far less under reduced motion", () => {
    const busy = plan({
      rows: [0, 1, 2, 3, 4, 5, 6, 7],
      columns: [0, 1, 2, 3, 4, 5, 6, 7],
      clearedCells: Array.from({ length: 64 }, (_, i) => ({
        row: Math.floor(i / 8),
        column: i % 8,
      })),
    });

    const full = buildEffectScene(busy, geometry, palette, false);
    const reduced = buildEffectScene(busy, geometry, palette, true);

    // Sweeps are the travelling part and go entirely; the flashes stay, because
    // the cleared line must still read as cleared.
    expect(reduced.sweeps).toHaveLength(0);
    expect(full.sweeps.length).toBeGreaterThan(0);
    expect(reduced.flashes.length).toBe(full.flashes.length);
  });
});
