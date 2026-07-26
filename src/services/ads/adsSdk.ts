import { NativeModules, TurboModuleRegistry } from "react-native";

/** Lazy, failure-tolerant access to the Google Mobile Ads SDK.
 *
 *  The package cannot be imported at module scope, and cannot even be imported
 *  speculatively. Its entry point loads eight spec modules, every one of which
 *  calls `TurboModuleRegistry.getEnforcing(...)` while it loads, and
 *  `getEnforcing` *throws* when the native module is absent. So in Expo Go — or
 *  in any development build made before the ad SDK was autolinked — importing
 *  the package raises an `Invariant Violation` before a single screen renders.
 *
 *  Catching that throw is not enough: React Native surfaces it in development
 *  regardless, so a build without ads gets a red error on every launch. The fix
 *  is to not cause it. `TurboModuleRegistry.get` is the non-throwing variant, so
 *  the native modules are probed first and the package is required only when
 *  every one of them is actually present.
 *
 *  Absent SDK therefore means no ads, silently, and nothing else. */

type AdsSdkModule = typeof import("react-native-google-mobile-ads");

/** Every native module the package's entry point demands. Taken from the
 *  `getEnforcing` calls in `react-native-google-mobile-ads/lib/commonjs/specs/`
 *  — all eight load eagerly, so a single missing one makes the import throw. */
const REQUIRED_NATIVE_MODULES = [
  "RNAppModule",
  "RNGoogleMobileAdsModule",
  "RNGoogleMobileAdsConsentModule",
  "RNGoogleMobileAdsAppOpenModule",
  "RNGoogleMobileAdsInterstitialModule",
  "RNGoogleMobileAdsNativeModule",
  "RNGoogleMobileAdsRewardedModule",
  "RNGoogleMobileAdsRewardedInterstitialModule",
] as const;

function hasNativeModule(name: string): boolean {
  try {
    // `get` returns null for a missing module instead of throwing, which is the
    // whole point — `getEnforcing` is what the package itself uses.
    if (TurboModuleRegistry.get(name) != null) {
      return true;
    }
  } catch {
    // A registry that cannot answer is treated as "not present".
  }
  const legacy = NativeModules as Record<string, unknown>;
  return legacy[name] != null;
}

/** True only when the ad SDK can be imported without throwing. */
export function hasAdsNativeModules(): boolean {
  return REQUIRED_NATIVE_MODULES.every(hasNativeModule);
}

/** `undefined` = not attempted yet, `null` = attempted and unavailable. */
let cached: AdsSdkModule | null | undefined;

/** The SDK, or `null` when this binary has no Google Mobile Ads native modules.
 *  Never throws, and never imports the package when it would throw. */
export function loadAdsSdk(): AdsSdkModule | null {
  if (cached === undefined) {
    cached = null;
    if (hasAdsNativeModules()) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        cached = require("react-native-google-mobile-ads") as AdsSdkModule;
      } catch {
        // Belt and braces: the probe should have prevented this, but a package
        // that fails to load for any other reason must still not take the app
        // down.
        cached = null;
      }
    }
  }
  return cached;
}

export function isAdsSdkAvailable(): boolean {
  return loadAdsSdk() !== null;
}

/** Shared wording for the one situation callers cannot do anything about. */
export const ADS_SDK_UNAVAILABLE_MESSAGE =
  "Google Mobile Ads is unavailable in this build. Ads and consent are disabled; " +
  "gameplay is unaffected. A development build that includes the ad SDK is required " +
  "(it does not work in Expo Go).";

export function adsSdkUnavailableError(): Error {
  return new Error(ADS_SDK_UNAVAILABLE_MESSAGE);
}

/** Test seam: forget whether the SDK was loadable. */
export function resetAdsSdkCacheForTests(): void {
  cached = undefined;
}
