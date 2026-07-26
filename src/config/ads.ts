import type { RewardedPlacement } from "../services/ads/types";
import { REWARD_PLACEMENTS } from "../services/ads/placements";

/** Google's published rewarded test ad unit. Serves a real, fillable test ad on
 *  any device with no AdMob account involved, so development and preview builds
 *  exercise the full load/show/earn path without touching live inventory.
 *  https://developers.google.com/admob/android/test-ads */
export const TEST_REWARDED_AD_UNIT_ID = "ca-app-pub-3940256099942544/5224354917";

/** Build environments, mirroring the `EXPO_PUBLIC_APP_ENV` values set per EAS
 *  build profile in `eas.json`. */
export type AdEnvironment = "development" | "preview" | "production";

/** How long a rewarded load may take before the attempt is abandoned. The ad
 *  SDK has no load timeout of its own: offline, `load()` can sit pending long
 *  enough that the player assumes the button is broken. */
export const REWARDED_LOAD_TIMEOUT_MS = 15_000;

/** Grace window after the ad closes during which a late `EARNED_REWARD` is
 *  still honoured. The Android SDK normally emits the reward before `CLOSED`,
 *  but the order is not contractual, and resolving on `CLOSED` alone would drop
 *  a reward the player genuinely earned. See `GoogleAdService`. */
export const REWARDED_EARN_GRACE_MS = 400;

/** The raw environment inputs, read as literal static property accesses.
 *  Expo's `EXPO_PUBLIC_` inlining is a compile-time substitution of exactly this
 *  syntax — a computed lookup such as `process.env[name]` is *not* rewritten and
 *  would read as `undefined` in a release bundle. */
export type RewardedAdEnv = {
  appEnv?: string;
  freeze?: string;
  defuse?: string;
  revive?: string;
  doubleBolts?: string;
  /** Applied to any placement without its own id, so a single-unit AdMob setup
   *  needs one variable rather than four. */
  fallback?: string;
};

const ENV: RewardedAdEnv = {
  appEnv: process.env.EXPO_PUBLIC_APP_ENV,
  freeze: process.env.EXPO_PUBLIC_ADMOB_REWARDED_FREEZE,
  defuse: process.env.EXPO_PUBLIC_ADMOB_REWARDED_DEFUSE,
  revive: process.env.EXPO_PUBLIC_ADMOB_REWARDED_REVIVE,
  doubleBolts: process.env.EXPO_PUBLIC_ADMOB_REWARDED_DOUBLE_BOLTS,
  fallback: process.env.EXPO_PUBLIC_ADMOB_REWARDED_DEFAULT,
};

/** Environment variable holding the rewarded ad unit for each placement.
 *  `app.config.ts` declares the same map — it cannot import this module, since
 *  Expo transpiles only the config entry file — so the two are kept in step by
 *  `__tests__/domain/adConfig.test.ts`. */
export const REWARDED_AD_UNIT_ENV_VARS: Record<keyof typeof REWARD_PLACEMENTS, string> = {
  freeze: "EXPO_PUBLIC_ADMOB_REWARDED_FREEZE",
  defuse: "EXPO_PUBLIC_ADMOB_REWARDED_DEFUSE",
  revive: "EXPO_PUBLIC_ADMOB_REWARDED_REVIVE",
  doubleBolts: "EXPO_PUBLIC_ADMOB_REWARDED_DOUBLE_BOLTS",
};

/** Applied to any placement without its own configured id. */
export const REWARDED_AD_UNIT_FALLBACK_ENV_VAR = "EXPO_PUBLIC_ADMOB_REWARDED_DEFAULT";

export function resolveAdEnvironment(env: RewardedAdEnv = ENV): AdEnvironment {
  return env.appEnv === "production"
    ? "production"
    : env.appEnv === "preview"
      ? "preview"
      : "development";
}

/** True for any ad unit published by Google as a test unit. Test units must
 *  never reach a production build: they serve no revenue and, worse, mask a
 *  missing configuration behind a working-looking ad. */
export function isGoogleTestAdUnit(adUnitId: string): boolean {
  return adUnitId.startsWith("ca-app-pub-3940256099942544/");
}

/** Ad unit id per placement. Development and preview resolve to Google's test
 *  unit; production reads the configured id and leaves the placement *absent*
 *  when it is missing, so the ad service reports `unavailable` instead of
 *  requesting an ad against a bad unit. `rewarded_repair_blast` is deliberately
 *  unmapped — it stays post-MVP (BUILD_SPEC.md §6.18). */
export function resolveRewardedAdUnitIds(
  env: RewardedAdEnv = ENV,
): Partial<Record<RewardedPlacement, string>> {
  const production = resolveAdEnvironment(env) === "production";
  const ids: Partial<Record<RewardedPlacement, string>> = {};
  for (const key of Object.keys(REWARD_PLACEMENTS) as (keyof typeof REWARD_PLACEMENTS)[]) {
    const placement = REWARD_PLACEMENTS[key];
    if (!production) {
      ids[placement] = TEST_REWARDED_AD_UNIT_ID;
      continue;
    }
    const configured = env[key] ?? env.fallback;
    if (configured && !isGoogleTestAdUnit(configured)) {
      ids[placement] = configured;
    }
  }
  return ids;
}

/** Every reason a production ad configuration is unusable, as human-readable
 *  lines. Empty means the configuration is complete. Pure so the build-time
 *  guard and its tests share one implementation. */
export function collectProductionAdConfigErrors(env: RewardedAdEnv = ENV): string[] {
  if (resolveAdEnvironment(env) !== "production") {
    return [];
  }
  const errors: string[] = [];
  for (const key of Object.keys(REWARDED_AD_UNIT_ENV_VARS) as (keyof typeof REWARD_PLACEMENTS)[]) {
    const configured = env[key] ?? env.fallback;
    if (!configured) {
      errors.push(
        `Missing rewarded ad unit for "${key}". Set ${REWARDED_AD_UNIT_ENV_VARS[key]} ` +
          `(or ${REWARDED_AD_UNIT_FALLBACK_ENV_VAR} for all placements).`,
      );
    } else if (isGoogleTestAdUnit(configured)) {
      errors.push(
        `Rewarded ad unit for "${key}" is a Google test unit (${configured}). ` +
          `Production builds must use a real AdMob ad unit id.`,
      );
    }
  }
  return errors;
}

/** The resolved ad unit ids for this bundle. The single place any ad unit id is
 *  read from — screens and components reference `REWARD_PLACEMENTS`, never ids. */
export const REWARDED_AD_UNIT_IDS = resolveRewardedAdUnitIds();

/** True when this bundle is a production build. Used to keep consent debug
 *  tooling (forced geography, consent reset) unreachable in production. */
export const IS_PRODUCTION_BUILD = resolveAdEnvironment() === "production";
