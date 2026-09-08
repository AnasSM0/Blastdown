// eslint-disable-next-line @typescript-eslint/no-require-imports
const { readFileSync } = require("node:fs") as {
  readFileSync: (path: string, encoding: string) => string;
};

type QualificationProfile = {
  developmentClient: boolean;
  distribution: string;
  environment: string;
  android: { buildType: string };
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
      expect(profile.android.buildType).toBe("apk");
      expect(profile.env.EXPO_PUBLIC_APP_ENV).toBe("development");
    }
    expect(fallback.env.EXPO_PUBLIC_CINEMATIC_BOARD).toBe("0");
    expect(cinematic.env.EXPO_PUBLIC_CINEMATIC_BOARD).toBe("1");
    expect(cinematic).toEqual({
      ...fallback,
      env: { ...fallback.env, EXPO_PUBLIC_CINEMATIC_BOARD: "1" },
    });
  });
});
