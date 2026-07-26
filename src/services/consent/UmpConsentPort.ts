import { adsSdkUnavailableError, loadAdsSdk } from "../ads/adsSdk";
import type {
  ConsentDebugGeography,
  ConsentInfo,
  ConsentPort,
  ConsentRequestOptions,
  ConsentStatus,
  PrivacyOptionsRequirement,
} from "./types";

/** The consent side of the ad SDK boundary.
 *
 *  The SDK is reached only through `loadAdsSdk`, never imported at module
 *  scope: importing it throws outright when the native module is absent (see
 *  `adsSdk.ts`). The mapping functions below are therefore deliberately pure
 *  and SDK-free — they translate the SDK's *wire values*, so they work whether
 *  or not the native module exists, and `__tests__/domain/adSdkMapping.test.ts`
 *  compares them against the real enum members to catch drift. */

/** UMP's `AdsConsentStatus` is a string enum whose values equal their names. */
const STATUSES: Record<string, ConsentStatus> = {
  UNKNOWN: "unknown",
  REQUIRED: "required",
  NOT_REQUIRED: "notRequired",
  OBTAINED: "obtained",
};

/** Likewise `AdsConsentPrivacyOptionsRequirementStatus`. */
const PRIVACY_OPTIONS: Record<string, PrivacyOptionsRequirement> = {
  UNKNOWN: "unknown",
  REQUIRED: "required",
  NOT_REQUIRED: "notRequired",
};

/** `AdsConsentDebugGeography` is a numeric enum. */
const GEOGRAPHIES: Record<ConsentDebugGeography, number> = {
  disabled: 0,
  eea: 1,
  regulatedUsState: 3,
  other: 4,
};

/** The shape `AdsConsent` reports back, as plain data. */
type RawConsentInfo = {
  status: string;
  canRequestAds: boolean;
  isConsentFormAvailable: boolean;
  privacyOptionsRequirementStatus: string;
};

/** Normalize a UMP snapshot. Unrecognised enum values fall back to the most
 *  conservative reading — unknown status, no ads — rather than throwing: an SDK
 *  that grows a new state must not break the launch path. */
export function toConsentInfo(info: RawConsentInfo): ConsentInfo {
  return {
    status: STATUSES[info.status] ?? "unknown",
    canRequestAds: info.canRequestAds === true,
    isConsentFormAvailable: info.isConsentFormAvailable === true,
    privacyOptionsRequirement: PRIVACY_OPTIONS[info.privacyOptionsRequirementStatus] ?? "unknown",
  };
}

export type RawConsentOptions = {
  debugGeography?: number;
  testDeviceIdentifiers?: string[];
  tagForUnderAgeOfConsent?: boolean;
};

export function toAdsConsentOptions(
  options: ConsentRequestOptions | undefined,
): RawConsentOptions | undefined {
  if (!options) {
    return undefined;
  }
  const mapped: RawConsentOptions = {};
  if (options.debugGeography) {
    mapped.debugGeography = GEOGRAPHIES[options.debugGeography];
  }
  if (options.testDeviceIdentifiers && options.testDeviceIdentifiers.length > 0) {
    mapped.testDeviceIdentifiers = options.testDeviceIdentifiers;
  }
  if (options.tagForUnderAgeOfConsent !== undefined) {
    mapped.tagForUnderAgeOfConsent = options.tagForUnderAgeOfConsent;
  }
  return mapped;
}

/** `ConsentPort` backed by Google's User Messaging Platform.
 *
 *  Constructing this never touches the SDK. Every method resolves the SDK on
 *  demand and rejects with a clear message when it is absent; `ConsentProvider`
 *  treats that as a lifecycle failure, which means ads off and gameplay
 *  untouched. */
export function createUmpConsentPort(): ConsentPort {
  return {
    async gather(options?: ConsentRequestOptions): Promise<ConsentInfo> {
      const sdk = loadAdsSdk();
      if (!sdk) {
        throw adsSdkUnavailableError();
      }
      // `gatherConsent` is UMP's own request-then-show-if-required helper: it
      // calls `requestInfoUpdate` and then `loadAndShowConsentFormIfRequired`,
      // so the launch path is a single native round trip and the form is never
      // shown when UMP says it is not needed.
      const info = await sdk.AdsConsent.gatherConsent(
        (toAdsConsentOptions(options) ?? {}) as Parameters<typeof sdk.AdsConsent.gatherConsent>[0],
      );
      return toConsentInfo(info as unknown as RawConsentInfo);
    },
    async showPrivacyOptionsForm(): Promise<ConsentInfo> {
      const sdk = loadAdsSdk();
      if (!sdk) {
        throw adsSdkUnavailableError();
      }
      const info = await sdk.AdsConsent.showPrivacyOptionsForm();
      return toConsentInfo(info as unknown as RawConsentInfo);
    },
    reset(): void {
      loadAdsSdk()?.AdsConsent.reset();
    },
  };
}
