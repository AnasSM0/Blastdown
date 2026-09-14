// eslint-disable-next-line @typescript-eslint/no-require-imports
const { readFileSync } = require("node:fs") as {
  readFileSync: (path: string, encoding: string) => string;
};

type QualificationProfile = {
  developmentClient?: boolean;
  distribution: string;
  environment: string;
  android?: { buildType: string };
  env: Record<string, string>;
};

const config = JSON.parse(readFileSync("eas.json", "utf8")) as {
  build: Record<string, QualificationProfile>;
};

describe("Android qualification profile contract", () => {
  it("isolates the renderer flag while keeping installable development clients equivalent", () => {
    const fallback = config.build["android-qualification-fallback"];
    const cinematic = config.build["android-qualification-cinematic"];
    expect(fallback).toBeDefined();
    expect(cinematic).toBeDefined();
    for (const profile of [fallback, cinematic]) {
      expect(profile).not.toHaveProperty("extends");
      expect(profile.developmentClient).toBe(true);
      expect(profile.distribution).toBe("internal");
      expect(profile.environment).toBe("development");
      expect(profile.android?.buildType).toBe("apk");
      expect(profile.env.EXPO_PUBLIC_APP_ENV).toBe("development");
    }
    expect(fallback.env.EXPO_PUBLIC_CINEMATIC_BOARD).toBe("0");
    expect(cinematic.env.EXPO_PUBLIC_CINEMATIC_BOARD).toBe("1");
    expect(cinematic).toEqual({
      ...fallback,
      env: { ...fallback.env, EXPO_PUBLIC_CINEMATIC_BOARD: "1" },
    });
  });

  it("makes the fallback renderer explicit in the production AAB profile", () => {
    const production = config.build.production;
    expect(production.environment).toBe("production");
    expect(production.developmentClient).not.toBe(true);
    expect(production.android?.buildType).toBe("app-bundle");
    expect(production.env.BLASTDOWN_BUILD_PLATFORM).toBe("android");
    expect(production.env.EXPO_PUBLIC_APP_ENV).toBe("production");
    expect(production.env.EXPO_PUBLIC_CINEMATIC_BOARD).toBe("0");
    expect(production.env.NPM_CONFIG_OMIT).toBe("optional");

    const productionIos = config.build["production-ios"];
    expect(productionIos.environment).toBe("production");
    expect(productionIos.developmentClient).not.toBe(true);
    expect(productionIos.env.BLASTDOWN_BUILD_PLATFORM).toBe("ios");
    expect(productionIos.env.EXPO_PUBLIC_APP_ENV).toBe("production");
    expect(productionIos.env.EXPO_PUBLIC_CINEMATIC_BOARD).toBe("0");
    expect(productionIos.env.NPM_CONFIG_OMIT).toBe("optional");
  });
});
