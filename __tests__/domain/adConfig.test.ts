import { collectProductionAdUnitErrors } from "../../app.config";
import {
  REWARDED_AD_UNIT_ENV_VARS,
  REWARDED_AD_UNIT_FALLBACK_ENV_VAR,
  TEST_REWARDED_AD_UNIT_ID,
  collectProductionAdConfigErrors,
  isGoogleTestAdUnit,
  resolveAdEnvironment,
  resolveRewardedAdUnitIds,
  type RewardedAdEnv,
} from "../../src/config/ads";
import { REWARD_PLACEMENTS } from "../../src/services/ads/placements";

const REAL_UNITS = {
  freeze: "ca-app-pub-1111111111111111/1111111111",
  defuse: "ca-app-pub-1111111111111111/2222222222",
  revive: "ca-app-pub-1111111111111111/3333333333",
  doubleBolts: "ca-app-pub-1111111111111111/4444444444",
};

/** The same fixture expressed as `process.env`, so the build-time guard in
 *  `app.config.ts` can be run against exactly the inputs the runtime resolver
 *  sees. */
function asProcessEnv(env: RewardedAdEnv): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const key of Object.keys(REWARDED_AD_UNIT_ENV_VARS) as (keyof typeof REWARD_PLACEMENTS)[]) {
    const value = env[key];
    if (value !== undefined) {
      out[REWARDED_AD_UNIT_ENV_VARS[key]] = value;
    }
  }
  if (env.fallback !== undefined) {
    out[REWARDED_AD_UNIT_FALLBACK_ENV_VAR] = env.fallback;
  }
  return out;
}

describe("ad environment resolution", () => {
  it("treats anything other than production/preview as development", () => {
    expect(resolveAdEnvironment({ appEnv: "production" })).toBe("production");
    expect(resolveAdEnvironment({ appEnv: "preview" })).toBe("preview");
    expect(resolveAdEnvironment({ appEnv: "development" })).toBe("development");
    expect(resolveAdEnvironment({})).toBe("development");
    expect(resolveAdEnvironment({ appEnv: "staging" })).toBe("development");
  });

  it("recognises Google's published test units", () => {
    expect(isGoogleTestAdUnit(TEST_REWARDED_AD_UNIT_ID)).toBe(true);
    expect(isGoogleTestAdUnit(REAL_UNITS.freeze)).toBe(false);
  });
});

describe("rewarded ad unit resolution", () => {
  it("uses the Google test unit for every placement outside production", () => {
    for (const appEnv of ["development", "preview"]) {
      const ids = resolveRewardedAdUnitIds({ appEnv, ...REAL_UNITS });
      // Configured production ids are deliberately ignored: a development build
      // must never request live inventory even when the variables are present.
      expect(ids).toEqual({
        [REWARD_PLACEMENTS.freeze]: TEST_REWARDED_AD_UNIT_ID,
        [REWARD_PLACEMENTS.defuse]: TEST_REWARDED_AD_UNIT_ID,
        [REWARD_PLACEMENTS.revive]: TEST_REWARDED_AD_UNIT_ID,
        [REWARD_PLACEMENTS.doubleBolts]: TEST_REWARDED_AD_UNIT_ID,
      });
    }
  });

  it("maps each production placement to its configured unit", () => {
    const ids = resolveRewardedAdUnitIds({ appEnv: "production", ...REAL_UNITS });
    expect(ids[REWARD_PLACEMENTS.freeze]).toBe(REAL_UNITS.freeze);
    expect(ids[REWARD_PLACEMENTS.defuse]).toBe(REAL_UNITS.defuse);
    expect(ids[REWARD_PLACEMENTS.revive]).toBe(REAL_UNITS.revive);
    expect(ids[REWARD_PLACEMENTS.doubleBolts]).toBe(REAL_UNITS.doubleBolts);
  });

  it("falls back to the shared unit for placements without their own", () => {
    const ids = resolveRewardedAdUnitIds({
      appEnv: "production",
      freeze: REAL_UNITS.freeze,
      fallback: REAL_UNITS.defuse,
    });
    expect(ids[REWARD_PLACEMENTS.freeze]).toBe(REAL_UNITS.freeze);
    expect(ids[REWARD_PLACEMENTS.revive]).toBe(REAL_UNITS.defuse);
  });

  it("leaves a production placement unmapped when it is missing or still a test unit", () => {
    const ids = resolveRewardedAdUnitIds({
      appEnv: "production",
      freeze: TEST_REWARDED_AD_UNIT_ID,
      defuse: REAL_UNITS.defuse,
    });
    // Unmapped, not defaulted: the ad service reports `unavailable` rather than
    // requesting against a test unit or a bad id in a live build.
    expect(ids[REWARD_PLACEMENTS.freeze]).toBeUndefined();
    expect(ids[REWARD_PLACEMENTS.revive]).toBeUndefined();
    expect(ids[REWARD_PLACEMENTS.defuse]).toBe(REAL_UNITS.defuse);
  });

  // `rewarded_repair_blast` is post-MVP (BUILD_SPEC.md §6.18) and has no unit.
  it("never maps the post-MVP repair-blast placement", () => {
    const ids = resolveRewardedAdUnitIds({ appEnv: "development" });
    expect(ids.rewarded_repair_blast).toBeUndefined();
  });
});

describe("production ad configuration guard", () => {
  it("passes only when every placement has a real unit", () => {
    expect(collectProductionAdConfigErrors({ appEnv: "production", ...REAL_UNITS })).toEqual([]);
  });

  it("reports the missing variable by name", () => {
    const errors = collectProductionAdConfigErrors({
      appEnv: "production",
      freeze: REAL_UNITS.freeze,
    });
    expect(errors).toHaveLength(3);
    expect(errors.join("\n")).toContain("EXPO_PUBLIC_ADMOB_REWARDED_DEFUSE");
    expect(errors.join("\n")).toContain(REWARDED_AD_UNIT_FALLBACK_ENV_VAR);
  });

  it("rejects a Google test unit in production", () => {
    const errors = collectProductionAdConfigErrors({
      appEnv: "production",
      fallback: TEST_REWARDED_AD_UNIT_ID,
    });
    expect(errors).toHaveLength(4);
    expect(errors[0]).toContain("Google test unit");
  });

  it("stays silent outside production", () => {
    expect(collectProductionAdConfigErrors({ appEnv: "development" })).toEqual([]);
    expect(collectProductionAdConfigErrors({ appEnv: "preview" })).toEqual([]);
  });

  // `app.config.ts` cannot import from `src/` (Expo transpiles only the config
  // entry file), so the rule is written twice. This is the guard against the two
  // copies drifting apart.
  it("agrees with the copy of the rule that runs at build time", () => {
    const fixtures: RewardedAdEnv[] = [
      { ...REAL_UNITS },
      { freeze: REAL_UNITS.freeze },
      { fallback: REAL_UNITS.freeze },
      { fallback: TEST_REWARDED_AD_UNIT_ID },
      { freeze: TEST_REWARDED_AD_UNIT_ID, fallback: REAL_UNITS.defuse },
      {},
    ];
    for (const fixture of fixtures) {
      expect(collectProductionAdConfigErrors({ ...fixture, appEnv: "production" })).toEqual(
        collectProductionAdUnitErrors(asProcessEnv(fixture)),
      );
    }
  });
});
