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

function transform(source: string, dev: boolean): string {
  return (
    babel.transformSync(source, {
      filename: "playtest-production-exclusion.ts",
      babelrc: false,
      configFile: false,
      presets: ["@babel/preset-typescript"],
      plugins: [
        [inlinePlugin, { dev, inlinePlatform: true, isWrapped: false, platform: "android" }],
        constantFoldingPlugin,
      ],
    })?.code ?? ""
  );
}

describe("human playtest diagnostics leave production bundles", () => {
  it("removes the observer and recorder implementation in production", () => {
    const source = readFileSync("src/dev/playtest/playtestEntry.ts", "utf8");
    expect(transform(source, true)).toContain('require("./PlaytestObserver")');
    expect(transform(source, false)).not.toContain('require("./PlaytestObserver")');
  });

  it("removes analytics/action/error recorder dependencies in production", () => {
    const source = readFileSync("src/services/playtest/signal.ts", "utf8");
    expect(transform(source, true)).toContain("recorderSingleton");
    expect(transform(source, false)).not.toContain("recorderSingleton");
  });

  it("keeps reset/export controls only behind the existing excluded harness", () => {
    const harness = readFileSync("src/dev/EffectHarnessScreen.tsx", "utf8");
    const entry = readFileSync("src/dev/effectHarnessEntry.ts", "utf8");
    expect(harness).toContain("PlaytestDashboard");
    expect(harness).toContain("playtest/PlaytestDashboard");
    expect(transform(entry, false)).not.toContain("EffectHarnessScreen");
  });
});
