/** The narrow surface `GoogleAdService` needs from a rewarded ad. Modelled as
 *  our own types rather than the SDK's so the service — where all the reward
 *  safety lives — is testable without a native module, and so an SDK upgrade
 *  changes one adapter rather than the state machine. */

/** Every event the service reacts to, normalized. `loaded` covers both of the
 *  SDK's load events; `earned` is the only one that may grant anything. */
export type RewardedAdEvent =
  | { type: "loaded" }
  | { type: "earned" }
  | { type: "closed" }
  | { type: "error"; code: string; message: string };

export type RewardedAdListener = (event: RewardedAdEvent) => void;

export interface RewardedAdHandle {
  load(): void;
  /** Present the ad. Rejects if the SDK refuses (most often: not loaded). */
  show(): Promise<void>;
  /** Subscribe to this ad's events. */
  subscribe(listener: RewardedAdListener): void;
  /** Drop every listener and release the instance. A rewarded ad is
   *  single-use, so a handle is never reused after it has been shown. */
  destroy(): void;
}

export interface RewardedAdPort {
  create(adUnitId: string): RewardedAdHandle;
}

/** Load-failure codes that mean "there is simply no ad right now" rather than
 *  "something is wrong". Reported as `unavailable`, which the screens treat as
 *  a quiet no-op rather than an error worth retrying. */
const NO_AD_AVAILABLE_CODES = ["no-fill", "network-error"];

export function isNoAdAvailableCode(code: string): boolean {
  return NO_AD_AVAILABLE_CODES.some((known) => code.includes(known));
}
