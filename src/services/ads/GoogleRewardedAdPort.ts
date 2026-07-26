import { AdEventType, RewardedAd, RewardedAdEventType } from "react-native-google-mobile-ads";

import type {
  RewardedAdEvent,
  RewardedAdHandle,
  RewardedAdListener,
  RewardedAdPort,
} from "./rewardedPort";

/** The only module in the ads seam that imports the ad SDK. It does no policy:
 *  no reward decisions, no retry, no gating. It translates SDK events into
 *  `RewardedAdEvent` and nothing else — every rule lives in `GoogleAdService`. */

/** Exported for `__tests__/domain/adSdkMapping.test.ts`: a wrong event name or a
 *  missed case here would be invisible until device QA. */
export function toEvent(type: string, payload: unknown): RewardedAdEvent | null {
  // Both load events mean the same thing to us; the rewarded one carries the
  // reward metadata, which we deliberately ignore (see `GoogleAdService`).
  if (type === RewardedAdEventType.LOADED || type === AdEventType.LOADED) {
    return { type: "loaded" };
  }
  if (type === RewardedAdEventType.EARNED_REWARD) {
    return { type: "earned" };
  }
  if (type === AdEventType.CLOSED) {
    return { type: "closed" };
  }
  if (type === AdEventType.ERROR) {
    const error = payload as { code?: string; message?: string } | undefined;
    return {
      type: "error",
      code: error?.code ?? "unknown",
      // Message text from the SDK is a code path description, not user data.
      message: error?.message ?? "Unknown ad error",
    };
  }
  // OPENED, CLICKED and PAID carry no decision for us.
  return null;
}

export function createGoogleRewardedAdPort(): RewardedAdPort {
  return {
    create(adUnitId: string): RewardedAdHandle {
      const ad = RewardedAd.createForAdRequest(adUnitId);
      let unsubscribe: (() => void) | null = null;

      return {
        load() {
          ad.load();
        },
        show() {
          // `show()` throws synchronously when the ad is not loaded; normalize
          // that to a rejection so callers only ever handle one failure shape.
          try {
            return ad.show();
          } catch (error) {
            return Promise.reject(error);
          }
        },
        subscribe(listener: RewardedAdListener) {
          unsubscribe = ad.addAdEventsListener(({ type, payload }) => {
            const event = toEvent(type, payload);
            if (event) {
              listener(event);
            }
          });
        },
        destroy() {
          unsubscribe?.();
          unsubscribe = null;
          ad.removeAllListeners();
        },
      };
    },
  };
}
