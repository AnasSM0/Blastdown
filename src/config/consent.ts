import type { ConsentDebugGeography, ConsentRequestOptions } from "../services/consent/types";
import { resolveAdEnvironment } from "./ads";

/** UMP debug tooling — forced geography, registered test devices, and the
 *  consent reset — is available in development builds only. A preview or
 *  production build must behave exactly as a real install does, and a forced
 *  geography reaching a shipped app would be a compliance problem, so the gate
 *  is the build environment rather than a runtime toggle. */
export const CONSENT_DEBUG_ENABLED = resolveAdEnvironment() === "development";

/** Raw debug inputs. Literal `process.env.EXPO_PUBLIC_*` accesses so the Expo
 *  bundler inlines them (see `src/config/ads.ts`). */
export type ConsentDebugEnv = {
  geography?: string;
  testDeviceIds?: string;
};

const ENV: ConsentDebugEnv = {
  geography: process.env.EXPO_PUBLIC_UMP_DEBUG_GEOGRAPHY,
  testDeviceIds: process.env.EXPO_PUBLIC_UMP_TEST_DEVICE_IDS,
};

const GEOGRAPHIES: Record<string, ConsentDebugGeography> = {
  disabled: "disabled",
  eea: "eea",
  regulated_us_state: "regulatedUsState",
  other: "other",
};

export function parseDebugGeography(value: string | undefined): ConsentDebugGeography | undefined {
  if (!value) {
    return undefined;
  }
  return GEOGRAPHIES[value.trim().toLowerCase()];
}

/** Comma-separated device hashes. The hash is printed to logcat by the ad SDK on
 *  first run ("Use RequestConfiguration.Builder.setTestDeviceIds(...)"), so it
 *  can only be filled in from a real device — see docs/TEST_ADS.md. */
export function parseTestDeviceIdentifiers(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

/** The options passed to `ConsentPort.gather` at launch. `undefined` in any
 *  non-development build, and in a development build with nothing configured —
 *  UMP then behaves exactly as it does for a real install.
 *
 *  `tagForUnderAgeOfConsent` is deliberately never set here: it depends on the
 *  owner's audience decision, which is still outstanding (docs/MONETIZATION.md
 *  §6). Guessing it wrong is a compliance failure in either direction. */
export function resolveConsentRequestOptions(
  env: ConsentDebugEnv = ENV,
  enabled: boolean = CONSENT_DEBUG_ENABLED,
): ConsentRequestOptions | undefined {
  if (!enabled) {
    return undefined;
  }
  const debugGeography = parseDebugGeography(env.geography);
  const testDeviceIdentifiers = parseTestDeviceIdentifiers(env.testDeviceIds);
  if (!debugGeography && testDeviceIdentifiers.length === 0) {
    return undefined;
  }
  const options: ConsentRequestOptions = {};
  if (debugGeography) {
    options.debugGeography = debugGeography;
  }
  if (testDeviceIdentifiers.length > 0) {
    options.testDeviceIdentifiers = testDeviceIdentifiers;
  }
  return options;
}

export const CONSENT_REQUEST_OPTIONS = resolveConsentRequestOptions();
