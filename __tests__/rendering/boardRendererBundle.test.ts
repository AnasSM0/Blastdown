/** The flag has to isolate the BUNDLE, not just initialisation.
 *
 *  `rendererIsolation.test.ts` already pins the runtime half: with the flag off
 *  the require never executes, so Skia never installs its JSI bindings. That was
 *  the defect the flag was built for and it is genuinely fixed.
 *
 *  It is not the whole claim. `boardRenderer.ts` gated its require on
 *  `isCinematicRendererEnabled()` — a function call — under a comment saying the
 *  bundler could see both sides. A function call is not a constant, so Metro
 *  folded nothing, `collectDependencies` walked into the require, and the
 *  cinematic renderer plus Skia plus Reanimated plus every canvas layer stayed
 *  in the production graph of a build that will never draw a single frame with
 *  them.
 *
 *  The same mistake, in the same shape, was made in `effectHarnessEntry.ts` a
 *  commit earlier. Both looked right. Both shipped the module.
 *
 *  So this suite runs the two passes that actually decide, over the real file:
 *  Expo's `expoInlineEnvVars` (which substitutes `EXPO_PUBLIC_*` with a literal
 *  in a production build) and Metro's `constantFoldingPlugin`. Then it asks what
 *  survived.
 *
 *  Deliberately NOT a source-pattern match. `docs/DECISIONS.md` records a guard
 *  that scanned source text certifying two separate broken blur implementations:
 *  a test that checks the shape of the code will always agree with the code. */

/* eslint-disable @typescript-eslint/no-require-imports */
const babel = require("@babel/core") as {
  transformSync: (code: string, options: Record<string, unknown>) => { code: string } | null;
};
const { constantFoldingPlugin } = require("metro-transform-plugins") as {
  constantFoldingPlugin: unknown;
};
const { readFileSync } = require("fs") as {
  readFileSync: (path: string, encoding: string) => string;
};

/** Expo's own inlining plugin, not a local imitation of it.
 *
 *  The guarantee this suite makes depends on what that plugin actually does, so
 *  modelling it here would only prove the model self-consistent. `babel-preset-expo`
 *  is a transitive dependency and its install location has moved between SDKs,
 *  hence the two candidates — a resolution failure is a real signal that the
 *  mechanism moved, and should fail loudly rather than be skipped. */
function loadExpoInlineEnvVars(): unknown {
  const candidates = [
    "babel-preset-expo/build/plugins/inline-env-vars",
    "expo/node_modules/babel-preset-expo/build/plugins/inline-env-vars",
  ];
  for (const id of candidates) {
    try {
      return (require(id) as { expoInlineEnvVars: unknown }).expoInlineEnvVars;
    } catch {
      continue;
    }
  }
  throw new Error(
    `Could not load Expo's inline-env-vars plugin from any of: ${candidates.join(", ")}. ` +
      "Bundle exclusion of the cinematic renderer depends on it — find where it moved.",
  );
}
const expoInlineEnvVars = loadExpoInlineEnvVars();
/* eslint-enable @typescript-eslint/no-require-imports */

/** Transform a module the way a PRODUCTION Android bundle would.
 *
 *  `isDev: false` in the caller is the whole point: Expo's plugin only
 *  substitutes a literal for a production build. In development it rewrites to a
 *  member access on a virtual module instead, which is correct there and folds
 *  nowhere — so a probe without this caller would report that nothing can ever
 *  be excluded, which is what it did the first time. */
function bundleFor(source: string, flag: string | undefined): string {
  const previous = process.env.EXPO_PUBLIC_CINEMATIC_BOARD;
  if (flag === undefined) {
    delete process.env.EXPO_PUBLIC_CINEMATIC_BOARD;
  } else {
    process.env.EXPO_PUBLIC_CINEMATIC_BOARD = flag;
  }
  try {
    return (
      babel.transformSync(source, {
        filename: "boardRenderer.ts",
        babelrc: false,
        configFile: false,
        presets: ["@babel/preset-typescript"],
        plugins: [expoInlineEnvVars, constantFoldingPlugin],
        caller: {
          name: "metro",
          bundler: "metro",
          platform: "android",
          isDev: false,
          isServer: false,
          isReactServer: false,
        },
      })?.code ?? ""
    );
  } finally {
    if (previous === undefined) {
      delete process.env.EXPO_PUBLIC_CINEMATIC_BOARD;
    } else {
      process.env.EXPO_PUBLIC_CINEMATIC_BOARD = previous;
    }
  }
}

const SOURCE = readFileSync("src/rendering/boardRenderer.ts", "utf8");

describe("the cinematic renderer leaves a disabled production bundle", () => {
  it.each([undefined, "", "0", "false", "views"])(
    "drops the cinematic require when the flag is %p",
    (flag) => {
      const output = bundleFor(SOURCE, flag);

      // Gone from the emitted module, so `collectDependencies` never sees it and
      // the whole cinematic subtree — Skia, Reanimated, the canvas layers —
      // leaves the graph with it.
      expect(output).not.toContain("CinematicBoard");
    },
  );

  it.each(["1", "true", "skia"])("keeps the cinematic require when the flag is %p", (flag) => {
    const output = bundleFor(SOURCE, flag);

    // The other direction matters as much: a gate that excluded the renderer
    // unconditionally would pass every test above and ship a flag that does
    // nothing.
    expect(output).toContain("CinematicBoard");
  });

  it("keeps the fallback renderer available either way", () => {
    // The point of the flag is that turning the cinematic renderer off rescues
    // the build. A fold that took `GameBoard` with it would be worse than the
    // bug.
    expect(bundleFor(SOURCE, undefined)).toContain("GameBoard");
    expect(bundleFor(SOURCE, "skia")).toContain("GameBoard");
  });

  it("folds the flag itself to a constant when disabled", () => {
    const output = bundleFor(SOURCE, undefined);

    // Not decoration: if `CINEMATIC_RENDERER` still had to be computed, the
    // expression computing it would be holding something alive.
    expect(output).toMatch(/CINEMATIC_RENDERER\s*=\s*false/);
  });
});

describe("the guard can tell the gate that shipped anyway", () => {
  it("still finds the require behind the function-call gate", () => {
    // The exact shape `boardRenderer.ts` had. It returns the right renderer at
    // runtime and never executes the require with the flag off — which is why
    // it survived review twice — and Metro cannot fold a function call, so the
    // module stays in the bundle regardless.
    const functionCallGate = `
      import { GameBoard } from "../components/GameBoard";
      import { isCinematicRendererEnabled } from "../config/renderer";
      export const CINEMATIC_RENDERER = isCinematicRendererEnabled();
      export const BoardRenderer = CINEMATIC_RENDERER
        ? require("../components/CinematicBoard").CinematicBoard
        : GameBoard;
    `;

    expect(bundleFor(functionCallGate, undefined)).toContain("CinematicBoard");
    expect(bundleFor(functionCallGate, "0")).toContain("CinematicBoard");
  });

  it("still finds the require when the branch folds but the require sits outside it", () => {
    // The near-miss from `effectHarnessEntry.ts`: the comparison IS constant and
    // the `if` DOES fold — to its consequent — leaving the require in the body
    // underneath, still collected.
    const invertedGate = `
      import { GameBoard } from "../components/GameBoard";
      export function pick() {
        if (process.env.EXPO_PUBLIC_CINEMATIC_BOARD !== "skia") { return GameBoard; }
        return require("../components/CinematicBoard").CinematicBoard;
      }
    `;

    expect(bundleFor(invertedGate, undefined)).toContain("CinematicBoard");
  });
});

describe("importing the resolver does not evaluate the cinematic module", () => {
  const original = process.env.EXPO_PUBLIC_CINEMATIC_BOARD;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.EXPO_PUBLIC_CINEMATIC_BOARD;
    } else {
      process.env.EXPO_PUBLIC_CINEMATIC_BOARD = original;
    }
    jest.resetModules();
  });

  it("never requires the cinematic board with the flag off", () => {
    delete process.env.EXPO_PUBLIC_CINEMATIC_BOARD;
    let evaluated = false;

    jest.isolateModules(() => {
      jest.doMock("../../src/components/CinematicBoard", () => {
        // Stands in for Skia installing its JSI bindings at module evaluation.
        evaluated = true;
        return { CinematicBoard: () => null };
      });

      /* eslint-disable @typescript-eslint/no-require-imports */
      const { BoardRenderer, CINEMATIC_RENDERER } = require("../../src/rendering/boardRenderer");
      const { GameBoard } = require("../../src/components/GameBoard");
      /* eslint-enable @typescript-eslint/no-require-imports */

      expect(CINEMATIC_RENDERER).toBe(false);
      expect(BoardRenderer).toBe(GameBoard);
    });

    expect(evaluated).toBe(false);
  });

  it("requires it exactly once with the flag on", () => {
    process.env.EXPO_PUBLIC_CINEMATIC_BOARD = "1";
    let evaluations = 0;

    jest.isolateModules(() => {
      const stub = () => null;
      jest.doMock("../../src/components/CinematicBoard", () => {
        evaluations += 1;
        return { CinematicBoard: stub };
      });

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { BoardRenderer, CINEMATIC_RENDERER } = require("../../src/rendering/boardRenderer");

      expect(CINEMATIC_RENDERER).toBe(true);
      expect(BoardRenderer).toBe(stub);
    });

    // Resolved at module scope, so the decision — and the initialisation behind
    // it — happens once rather than per render.
    expect(evaluations).toBe(1);
  });
});
