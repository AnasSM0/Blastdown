/** Lazy, failure-tolerant access to the Google Mobile Ads SDK.
 *
 *  The package cannot be imported at module scope. Its entry point re-exports
 *  `AdsConsent`, which pulls in a module that calls
 *  `TurboModuleRegistry.getEnforcing(...)` while it loads — and `getEnforcing`
 *  throws when the native module is absent. A static import therefore takes the
 *  whole app down at startup in Expo Go, or in any development build made
 *  before the ad SDK was autolinked, before a single screen renders.
 *
 *  That would make gameplay depend on ads, which is exactly the thing the ads
 *  seam exists to prevent. So the SDK is required lazily, once, behind a
 *  try/catch: absent SDK means no ads, and nothing else. */

type AdsSdkModule = typeof import("react-native-google-mobile-ads");

/** `undefined` = not attempted yet, `null` = attempted and unavailable. */
let cached: AdsSdkModule | null | undefined;

/** The SDK, or `null` when this binary has no Google Mobile Ads native module.
 *  Never throws. */
export function loadAdsSdk(): AdsSdkModule | null {
  if (cached === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cached = require("react-native-google-mobile-ads") as AdsSdkModule;
    } catch {
      cached = null;
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
