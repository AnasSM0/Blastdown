import mobileAds, {
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
} from "react-native-google-mobile-ads";

import type { AdService, RewardedPlacement, RewardedResult } from "./types";

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
  initialize(): Promise<void>;
  createRewarded(adUnitId: string): NativeRewardedAd;
};

const LOAD_TIMEOUT_MS = 30_000;

const nativeSdk: GoogleMobileAdsSdk = {
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
};

/** Native rewarded adapter. Missing unit IDs are deliberately represented as
 * unavailable inventory, never as Google test IDs and never as an earned
 * result. Instances are bounded to one pending load per approved placement. */
export function createGoogleMobileAdsService(
  unitIds: RewardedUnitIds,
  sdk: GoogleMobileAdsSdk = nativeSdk,
): AdService {
  const pendingLoads = new Map<RewardedPlacement, Promise<NativeRewardedAd | null>>();
  let initialization: Promise<void> | null = null;

  function initialize(): Promise<void> {
    initialization ??= sdk.initialize();
    return initialization;
  }

  function beginLoad(placement: RewardedPlacement): Promise<NativeRewardedAd | null> {
    const existing = pendingLoads.get(placement);
    if (existing) return existing;
    const unitId = unitIds[placement];
    if (!unitId) return Promise.resolve(null);

    const pending = initialize()
      .then(
        () =>
          new Promise<NativeRewardedAd | null>((resolve) => {
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
          }),
      )
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
  };
}
