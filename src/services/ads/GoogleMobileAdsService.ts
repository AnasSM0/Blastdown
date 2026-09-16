import mobileAds, {
  AdEventType,
  AdsConsent,
  AdsConsentPrivacyOptionsRequirementStatus,
  RewardedAd,
  RewardedAdEventType,
} from "react-native-google-mobile-ads";

import type { AdService, PrivacyOptionsResult, RewardedPlacement, RewardedResult } from "./types";

export type RewardedUnitIds = Readonly<Record<RewardedPlacement, string | null>>;

type RewardedEvent =
  | typeof AdEventType.CLOSED
  | typeof AdEventType.ERROR
  | typeof RewardedAdEventType.EARNED_REWARD
  | typeof RewardedAdEventType.LOADED;

export type NativeRewardedAd = {
  addAdEventsListener(listener: (event: { type: RewardedEvent }) => void): () => void;
  load(): void;
  removeAllListeners(): void;
  show(): Promise<void>;
};

export type GoogleMobileAdsSdk = {
  gatherConsent(): Promise<boolean>;
  initialize(): Promise<void>;
  createRewarded(adUnitId: string): NativeRewardedAd;
  showPrivacyOptions(): Promise<PrivacyOptionsResult>;
};

const LOAD_TIMEOUT_MS = 30_000;

const nativeSdk: GoogleMobileAdsSdk = {
  async gatherConsent() {
    // UMP remains authoritative for consent state. No BlastDown preference or
    // made-up GDPR flag is persisted alongside it.
    const info = await AdsConsent.gatherConsent();
    return info.canRequestAds;
  },
  async initialize() {
    await mobileAds().initialize();
  },
  createRewarded(adUnitId) {
    return RewardedAd.createForAdRequest(adUnitId, {
      // Consent UI is a separate release gate. Until it is wired, request the
      // least-personalized inventory supported by this adapter.
      requestNonPersonalizedAdsOnly: true,
    });
  },
  async showPrivacyOptions() {
    try {
      const info = await AdsConsent.requestInfoUpdate();
      if (
        info.privacyOptionsRequirementStatus !== AdsConsentPrivacyOptionsRequirementStatus.REQUIRED
      ) {
        return "not-required";
      }
      await AdsConsent.showPrivacyOptionsForm();
      return "shown";
    } catch {
      return "error";
    }
  },
};

/** Native rewarded adapter. Missing unit IDs are deliberately represented as
 * unavailable inventory, never as Google test IDs and never as an earned
 * result. Instances are bounded to one pending load per approved placement. */
export function createGoogleMobileAdsService(
  unitIds: RewardedUnitIds,
  sdk: GoogleMobileAdsSdk = nativeSdk,
): AdService {
  const pendingLoads = new Map<RewardedPlacement, Promise<NativeRewardedAd | null>>();
  let consentEligibility: Promise<boolean> | null = null;
  let initialization: Promise<void> | null = null;

  function prepareForAds(): Promise<boolean> {
    consentEligibility ??= sdk.gatherConsent().catch(() => false);
    return consentEligibility.then(async (canRequestAds) => {
      if (!canRequestAds) return false;
      initialization ??= sdk.initialize();
      try {
        await initialization;
        return true;
      } catch {
        return false;
      }
    });
  }

  function beginLoad(placement: RewardedPlacement): Promise<NativeRewardedAd | null> {
    const existing = pendingLoads.get(placement);
    if (existing) return existing;
    const unitId = unitIds[placement];
    if (!unitId) return Promise.resolve(null);

    const pending = prepareForAds()
      .then((canRequestAds) => {
        if (!canRequestAds) return null;
        return new Promise<NativeRewardedAd | null>((resolve) => {
          const ad = sdk.createRewarded(unitId);
          let settled = false;
          let unsubscribe = () => {};
          const finish = (value: NativeRewardedAd | null) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            unsubscribe();
            resolve(value);
          };
          const timeout = setTimeout(() => finish(null), LOAD_TIMEOUT_MS);
          unsubscribe = ad.addAdEventsListener(({ type }) => {
            if (type === RewardedAdEventType.LOADED) finish(ad);
            if (type === AdEventType.ERROR) finish(null);
          });
          try {
            ad.load();
          } catch {
            finish(null);
          }
        });
      })
      .catch(() => null);
    pendingLoads.set(placement, pending);
    return pending;
  }

  return {
    async preloadRewarded(placement) {
      if (!unitIds[placement]) return;
      await beginLoad(placement);
    },

    async showRewarded(placement): Promise<RewardedResult> {
      if (!unitIds[placement]) return "unavailable";
      const ad = await beginLoad(placement);
      pendingLoads.delete(placement);
      if (!ad) return "error";

      return new Promise<RewardedResult>((resolve) => {
        let earned = false;
        let settled = false;
        let unsubscribe = () => {};
        const finish = (result: RewardedResult) => {
          if (settled) return;
          settled = true;
          unsubscribe();
          ad.removeAllListeners();
          resolve(result);
        };
        unsubscribe = ad.addAdEventsListener(({ type }) => {
          if (type === RewardedAdEventType.EARNED_REWARD) earned = true;
          if (type === AdEventType.CLOSED) finish(earned ? "earned" : "closed");
          if (type === AdEventType.ERROR) finish("error");
        });
        void ad.show().catch(() => finish("error"));
      });
    },

    async showPrivacyOptions() {
      const result = await sdk.showPrivacyOptions();
      // The next ad request must re-check UMP after a choice changes.
      consentEligibility = null;
      initialization = null;
      pendingLoads.clear();
      return result;
    },
  };
}
