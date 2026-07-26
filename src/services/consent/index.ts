/** `UmpConsentPort` is deliberately absent from this barrel: it is the one
 *  module that imports `react-native-google-mobile-ads`, and re-exporting it
 *  here would pull the native SDK into every consumer of the consent seam.
 *  `app/_layout.tsx` imports it directly. */
export {
  ConsentProvider,
  useConsent,
  useOptionalConsent,
  type ConsentController,
} from "./ConsentProvider";
export {
  createMockConsentPort,
  type MockConsentConfig,
  type MockConsentOutcome,
  type MockConsentPort,
} from "./MockConsentPort";
export {
  INITIAL_CONSENT_STATE,
  areAdsAllowed,
  isConsentFormRequired,
  isPrivacyOptionsRequired,
  type ConsentDebugGeography,
  type ConsentFailure,
  type ConsentInfo,
  type ConsentPhase,
  type ConsentPort,
  type ConsentRequestOptions,
  type ConsentState,
  type ConsentStatus,
  type PrivacyOptionsRequirement,
} from "./types";
