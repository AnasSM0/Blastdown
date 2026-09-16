/** Guards the Skia jest mock against the renderer outgrowing it.
 *
 *  `test-utils/skiaMock.tsx` replaces `@shopify/react-native-skia` for the whole
 *  suite, so every renderer test runs against names the mock defines rather than
 *  names the library defines. That is a trap this repository has walked into
 *  once already: `adSdkMapping.test.ts` drove its assertions from a stubbed ad
 *  SDK, so a green suite could not have caught an upstream rename.
 *
 *  The obvious guard — load the real package and diff its exports — is not
 *  available. Importing it under jest throws "Native Skia Module failed to
 *  correctly install JSI Bindings", because the entry point installs native
 *  bindings at module scope. There is no way to ask the real library what it
 *  exports without a device.
 *
 *  So the drift is caught from both sides by different tools, and it is worth
 *  being explicit about which does what:
 *
 *  - **A name the library dropped or renamed** is caught by `npm run typecheck`.
 *    The renderer imports Skia by name against the real `.d.ts` files, so a
 *    rename is a compile error regardless of what the mock says. That is the
 *    stronger of the two guards and it needs no test.
 *
 *  - **A name the renderer newly imports that the mock lacks** is caught here.
 *    Typecheck is happy with it (the library really does export it) and the
 *    failure would otherwise surface as an obscure "undefined is not a
 *    component" inside whichever suite happened to render that layer.
 *
 *  What neither catches is a name that survives with a changed runtime shape.
 *  That is a device question, and it is listed as one in
 *  `docs/CINEMATIC_RENDERER.md`. */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { readFileSync, readdirSync, statSync } = require("fs") as {
  readFileSync: (path: string, encoding: string) => string;
  readdirSync: (path: string) => string[];
  statSync: (path: string) => { isDirectory: () => boolean };
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const skiaMock = require("../../test-utils/skiaMock") as Record<string, unknown>;

const RENDERER_ROOT = "src/rendering/cinematic";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = `${dir}/${entry}`;
    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }
    return path.endsWith(".ts") || path.endsWith(".tsx") ? [path] : [];
  });
}

/** Every RUNTIME identifier imported from Skia anywhere under the renderer.
 *
 *  Type-only imports are excluded — both `import type { SkFont }` blocks and
 *  inline `type` specifiers — because a type is erased before the mock is ever
 *  consulted. Including them would demand the mock export values for things that
 *  do not exist at runtime, which is the opposite of what this guards. */
function importedSkiaNames(): Set<string> {
  const names = new Set<string>();
  const importBlock = /import\s+(type\s+)?\{([^}]*)\}\s+from\s+"@shopify\/react-native-skia"/g;
  for (const file of sourceFiles(RENDERER_ROOT)) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(importBlock)) {
      if (match[1]) {
        continue;
      }
      for (const raw of match[2].split(",")) {
        const specifier = raw.trim();
        if (!specifier || /^type\s/.test(specifier)) {
          continue;
        }
        names.add(specifier.split(/\s+as\s+/)[0].trim());
      }
    }
  }
  return names;
}

describe("the Skia jest mock covers what the renderer imports", () => {
  it("provides every Skia name used under src/rendering/cinematic", () => {
    const imported = [...importedSkiaNames()].sort();
    const missing = imported.filter((name) => !(name in skiaMock));

    // A name here means some suite is one render away from "undefined is not a
    // component". Add it to test-utils/skiaMock.tsx.
    expect({ imported: imported.length > 0, missing }).toEqual({ imported: true, missing: [] });
  });

  it("renders a Skia element to nothing rather than throwing", () => {
    // The mock's whole contract in one assertion: a drawing element is a real
    // component that mounts and produces no output, which is what lets the
    // integration suites mount the cinematic board and assert on the React
    // Native accessibility layer over it.
    const Canvas = skiaMock.Canvas as (props: Record<string, unknown>) => unknown;

    expect(typeof Canvas).toBe("function");
    expect(Canvas({ children: "ignored" })).toBeNull();
  });
});
