import mobileAds from "react-native-google-mobile-ads";

/** Memoized so the SDK is initialized once per process, however many times the
 *  consent lifecycle observes `canRequestAds` becoming true. A rejection is
 *  memoized too: initialization failing once in a session will fail the same
 *  way again, and retrying would only delay every later ad request. */
let initialization: Promise<void> | null = null;

/** Initialize the Google Mobile Ads SDK. Call only after UMP reports that ads
 *  may be requested — initializing earlier starts the SDK's own collection
 *  before the user has made a consent decision. */
export function initializeMobileAdsOnce(): Promise<void> {
  initialization ??= mobileAds()
    .initialize()
    .then(() => undefined);
  return initialization;
}
