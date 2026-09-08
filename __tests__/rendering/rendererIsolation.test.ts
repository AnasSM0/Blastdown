/** The flag has to isolate INITIALISATION, not just rendering.
 *
 *  `@shopify/react-native-skia` installs its native JSI bindings when the module
 *  is evaluated, not when a component using it first renders. Importing the real
 *  package under jest throws "Native Skia Module failed to correctly install JSI
 *  Bindings" for exactly that reason — the failure happens at import.
 *
 *  So a top-level `import { CinematicBoard }` in the game screen would have
 *  initialised Skia at app startup even with the flag off, and that defeats the
 *  point of having a flag. The fallback renderer is meant to be the thing that
 *  rescues a build when the new path is broken; if Skia cannot initialise on a
 *  device, turning the renderer off has to actually help.
 *
 *  That was a real defect in the first version of the integration, caught in
 *  review. These tests pin both halves of the fix: the runtime behaviour of the
 *  resolver, and the structural rule that nothing sneaks Skia back into the
 *  startup path through a different door. */

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

describe("the resolver picks a renderer without evaluating the other one", () => {
  const original = process.env.EXPO_PUBLIC_CINEMATIC_BOARD;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.EXPO_PUBLIC_CINEMATIC_BOARD;
    } else {
      process.env.EXPO_PUBLIC_CINEMATIC_BOARD = original;
    }
    jest.resetModules();
  });

  it("resolves to the React Native board when the flag is off", () => {
    delete process.env.EXPO_PUBLIC_CINEMATIC_BOARD;

    jest.isolateModules(() => {
      // `require` rather than `import`, because the point is to evaluate these
      // modules fresh under a specific flag value — which a hoisted import
      // cannot do.
      /* eslint-disable @typescript-eslint/no-require-imports */
      const { BoardRenderer, CINEMATIC_RENDERER } = require("../../src/rendering/boardRenderer");
      const { GameBoard } = require("../../src/components/GameBoard");
      /* eslint-enable @typescript-eslint/no-require-imports */

      expect(CINEMATIC_RENDERER).toBe(false);
      expect(BoardRenderer).toBe(GameBoard);
    });
  });

  it("resolves to the cinematic board when the flag is on", () => {
    process.env.EXPO_PUBLIC_CINEMATIC_BOARD = "1";

    jest.isolateModules(() => {
      /* eslint-disable @typescript-eslint/no-require-imports */
      const { BoardRenderer, CINEMATIC_RENDERER } = require("../../src/rendering/boardRenderer");
      const { CinematicBoard } = require("../../src/components/CinematicBoard");
      /* eslint-enable @typescript-eslint/no-require-imports */

      // Both branches are exercised, so neither can rot. Under jest the Skia
      // mock makes the "on" branch harmless; in a real build it is the branch
      // that installs the native bindings, which is the whole reason it is
      // behind a require rather than an import.
      expect(CINEMATIC_RENDERER).toBe(true);
      expect(BoardRenderer).toBe(CinematicBoard);
    });
  });
});

describe("nothing pulls Skia into the startup path", () => {
  it("keeps the game screen free of a static cinematic import", () => {
    const source = readFileSync("app/game.tsx", "utf8");

    // A static import is evaluated on module load regardless of the flag.
    expect(/^import\s[^;]*from\s+".*CinematicBoard"/m.test(source)).toBe(false);
    expect(source).not.toMatch(/from "@shopify\/react-native-skia"/);
    expect(source).not.toMatch(/from "react-native-reanimated"/);
  });

  it("reaches the cinematic board only through a require, never a static import", () => {
    const source = readFileSync("src/rendering/boardRenderer.ts", "utf8");

    // The require must exist, or the renderer is unreachable; and it must not be
    // a static import wearing a different hat, which would evaluate Skia at
    // startup regardless of the flag.
    expect(source).toMatch(/require\("\.\.\/components\/CinematicBoard"\)/);
    expect(/^import\s[^;]*from\s+".*CinematicBoard"/m.test(source)).toBe(false);

    // What this test does NOT assert any more: the exact shape of the gate. It
    // used to pin the ternary `CINEMATIC_RENDERER ? require(...) : GameBoard`,
    // and that ternary was the bug — it kept the cinematic module in every
    // production bundle, because Metro cannot fold a function call. A guard that
    // pins a shape certifies whatever shape is there.
    //
    // `boardRendererBundle.test.ts` runs Expo's inlining plugin and Metro's
    // constant folding over this file and asks what survived, which is a
    // question the source text cannot answer.
  });

  it("imports Skia only from the two directories the flag gates", () => {
    // A shared helper that innocently imported Skia would put the
    // initialisation back into startup without anyone touching the screen or
    // the resolver.
    const offenders = sourceFiles("src")
      .filter(
        (file) =>
          !file.startsWith("src/rendering/cinematic/") &&
          !file.startsWith("src/components/CinematicBoard/"),
      )
      .filter((file) => /from "@shopify\/react-native-skia"/.test(readFileSync(file, "utf8")));

    expect(offenders).toEqual([]);
  });
});
