import {
  AdsConsent,
  AdsConsentDebugGeography,
  AdsConsentPrivacyOptionsRequirementStatus,
  AdsConsentStatus,
  type AdsConsentInfo,
  type AdsConsentInfoOptions,
} from "react-native-google-mobile-ads";

import type {
  ConsentDebugGeography,
  ConsentInfo,
  ConsentPort,
  ConsentRequestOptions,
  ConsentStatus,
  PrivacyOptionsRequirement,
} from "./types";

/** The only module in the consent seam that imports the ad SDK. Everything else
 *  — the lifecycle, the Settings entry point, the tests — works against
 *  `ConsentPort`, so none of it needs a native module present. */

const STATUSES: Record<AdsConsentStatus, ConsentStatus> = {
  [AdsConsentStatus.UNKNOWN]: "unknown",
  [AdsConsentStatus.REQUIRED]: "required",
  [AdsConsentStatus.NOT_REQUIRED]: "notRequired",
  [AdsConsentStatus.OBTAINED]: "obtained",
};

const PRIVACY_OPTIONS: Record<
  AdsConsentPrivacyOptionsRequirementStatus,
  PrivacyOptionsRequirement
> = {
  [AdsConsentPrivacyOptionsRequirementStatus.UNKNOWN]: "unknown",
  [AdsConsentPrivacyOptionsRequirementStatus.REQUIRED]: "required",
  [AdsConsentPrivacyOptionsRequirementStatus.NOT_REQUIRED]: "notRequired",
};

const GEOGRAPHIES: Record<ConsentDebugGeography, AdsConsentDebugGeography> = {
  disabled: AdsConsentDebugGeography.DISABLED,
  eea: AdsConsentDebugGeography.EEA,
  regulatedUsState: AdsConsentDebugGeography.REGULATED_US_STATE,
  other: AdsConsentDebugGeography.OTHER,
};

/** Normalize a UMP snapshot. Unrecognised enum values fall back to the most
 *  conservative reading — unknown status, no ads — rather than throwing: an SDK
 *  that grows a new state must not break the launch path. */
export function toConsentInfo(info: AdsConsentInfo): ConsentInfo {
  return {
    status: STATUSES[info.status] ?? "unknown",
    canRequestAds: info.canRequestAds === true,
    isConsentFormAvailable: info.isConsentFormAvailable === true,
    privacyOptionsRequirement: PRIVACY_OPTIONS[info.privacyOptionsRequirementStatus] ?? "unknown",
  };
}

export function toAdsConsentOptions(
  options: ConsentRequestOptions | undefined,
): AdsConsentInfoOptions | undefined {
  if (!options) {
    return undefined;
  }
  const mapped: AdsConsentInfoOptions = {};
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

/** `ConsentPort` backed by Google's User Messaging Platform. */
export function createUmpConsentPort(): ConsentPort {
  return {
    async gather(options?: ConsentRequestOptions): Promise<ConsentInfo> {
      // `gatherConsent` is UMP's own request-then-show-if-required helper: it
      // calls `requestInfoUpdate` and then `loadAndShowConsentFormIfRequired`,
      // so the launch path is a single native round trip and the form is never
      // shown when UMP says it is not needed.
      return toConsentInfo(await AdsConsent.gatherConsent(toAdsConsentOptions(options) ?? {}));
    },
    async showPrivacyOptionsForm(): Promise<ConsentInfo> {
      return toConsentInfo(await AdsConsent.showPrivacyOptionsForm());
    },
    reset(): void {
      AdsConsent.reset();
    },
  };
}
