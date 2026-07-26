import { adsSdkUnavailableError, loadAdsSdk } from "./adsSdk";
import type {
  RewardedAdEvent,
  RewardedAdHandle,
  RewardedAdListener,
  RewardedAdPort,
} from "./rewardedPort";

/** The rewarded side of the ad SDK boundary. It does no policy: no reward
 *  decisions, no retry, no gating. It translates SDK events into
 *  `RewardedAdEvent` and nothing else — every rule lives in `GoogleAdService`.
 *
 *  The SDK is reached only through `loadAdsSdk`, never imported at module
 *  scope (see `adsSdk.ts`). `toEvent` therefore matches the SDK's *wire
 *  values* rather than its enum members, so it is pure and works with or
 *  without the native module; `__tests__/domain/adSdkMapping.test.ts` compares
 *  these literals against the real enums to catch drift. */

const LOADED = "loaded";
const REWARDED_LOADED = "rewarded_loaded";
const EARNED_REWARD = "rewarded_earned_reward";
const CLOSED = "closed";
const ERROR = "error";

export function toEvent(type: string, payload: unknown): RewardedAdEvent | null {
  // Both load events mean the same thing to us; the rewarded one carries the
  // reward metadata, which we deliberately ignore (see `GoogleAdService`).
  if (type === REWARDED_LOADED || type === LOADED) {
    return { type: "loaded" };
  }
  if (type === EARNED_REWARD) {
    return { type: "earned" };
  }
  if (type === CLOSED) {
    return { type: "closed" };
  }
  if (type === ERROR) {
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

/** Constructing the port never touches the SDK. `create` resolves it on demand
 *  and throws if it is absent — a state `AdsRuntimeProvider` avoids reaching by
 *  configuring no ad units at all when the SDK is unavailable. */
export function createGoogleRewardedAdPort(): RewardedAdPort {
  return {
    create(adUnitId: string): RewardedAdHandle {
      const sdk = loadAdsSdk();
      if (!sdk) {
        throw adsSdkUnavailableError();
      }
      const ad = sdk.RewardedAd.createForAdRequest(adUnitId);
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
