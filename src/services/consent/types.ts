/** BlastDown's own view of the UMP consent state. Deliberately independent of
 *  `react-native-google-mobile-ads`: only `UmpConsentPort` imports that package,
 *  so the lifecycle, the screens and every test run without a native module. */

/** Whether the user still owes a consent decision. Mirrors UMP's
 *  `AdsConsentStatus`. */
export type ConsentStatus = "unknown" | "required" | "notRequired" | "obtained";

/** Whether the app must expose a persistent "privacy options" entry point.
 *  Required for users under a regulation that lets them revisit their choice;
 *  UMP alone decides this, so the Settings row is shown only when it says so. */
export type PrivacyOptionsRequirement = "unknown" | "required" | "notRequired";

/** A normalized snapshot of UMP's consent information. */
export type ConsentInfo = {
  status: ConsentStatus;
  /** UMP's own answer to "may this app request ads right now". The only gate the
   *  ad service consults — never re-derived from `status`, because the two can
   *  legitimately disagree (e.g. a partial consent that still permits ads). */
  canRequestAds: boolean;
  isConsentFormAvailable: boolean;
  privacyOptionsRequirement: PrivacyOptionsRequirement;
};

/** Where the lifecycle currently is. `error` means the launch sequence failed
 *  and there is no usable snapshot — never that the app is unusable, since
 *  gameplay is entirely offline and continues regardless. */
export type ConsentPhase = "idle" | "loading" | "ready" | "error";

/** Which step failed. Kept separate from the message so the UI can react to the
 *  kind of failure without parsing text.
 *
 *  Note that a `privacyOptions` failure is recorded *without* leaving the phase
 *  `ready`: the launch snapshot is still valid and only a dialog failed to
 *  open. A failure and a `ready` phase together therefore mean "the last action
 *  failed, the snapshot stands". See `ConsentProvider`. */
export type ConsentFailure = "request" | "form" | "privacyOptions";

export type ConsentState = ConsentInfo & {
  phase: ConsentPhase;
  failure: ConsentFailure | null;
  errorMessage: string | null;
};

/** Debug geography, as our own union so the UMP enum stays behind the port. */
export type ConsentDebugGeography = "disabled" | "eea" | "regulatedUsState" | "other";

export type ConsentRequestOptions = {
  /** Development builds only. Without a forced geography *and* a registered
   *  test device, a form never appears outside the EEA and "no form" is
   *  indistinguishable from "consent is broken". */
  debugGeography?: ConsentDebugGeography;
  testDeviceIdentifiers?: string[];
  /** Left unset until the owner records the app's audience. Setting it wrongly
   *  is a compliance problem in both directions, so it is never guessed. */
  tagForUnderAgeOfConsent?: boolean;
};

/** The seam the consent lifecycle talks to. `UmpConsentPort` is the real one;
 *  `createMockConsentPort` backs tests and any build without the native SDK. */
export interface ConsentPort {
  /** Request fresh consent information and present the form if UMP reports one
   *  is required — steps 1 and 2 of the launch sequence, in one native round
   *  trip (UMP's own `gatherConsent`). */
  gather(options?: ConsentRequestOptions): Promise<ConsentInfo>;
  /** Re-present the privacy options form, for the Settings entry point. */
  showPrivacyOptionsForm(): Promise<ConsentInfo>;
  /** Clear UMP's stored state so a first-launch flow can be replayed.
   *  Development builds only — see `CONSENT_DEBUG_ENABLED`. */
  reset(): void;
}

export const INITIAL_CONSENT_STATE: ConsentState = {
  phase: "idle",
  status: "unknown",
  canRequestAds: false,
  isConsentFormAvailable: false,
  privacyOptionsRequirement: "unknown",
  failure: null,
  errorMessage: null,
};

/** A consent form is owed: the user has not decided and UMP has a form to show. */
export function isConsentFormRequired(state: ConsentState): boolean {
  return state.status === "required" && state.isConsentFormAvailable;
}

/** The Settings privacy row is shown on exactly this condition, and only once
 *  the lifecycle has actually reported — never speculatively while loading.
 *
 *  A failed attempt to open the form does not clear it: the row is the entry
 *  point for retrying, and the lifecycle only runs once per launch, so hiding it
 *  on failure would remove it for the whole session. */
export function isPrivacyOptionsRequired(state: ConsentState): boolean {
  return state.phase === "ready" && state.privacyOptionsRequirement === "required";
}

/** Ads may be requested. False covers every "ads unavailable" case: consent
 *  outstanding, consent refused, and a failed or still-loading lifecycle. */
export function areAdsAllowed(state: ConsentState): boolean {
  return state.phase === "ready" && state.canRequestAds;
}
