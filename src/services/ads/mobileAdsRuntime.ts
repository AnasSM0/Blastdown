import { adsSdkUnavailableError, loadAdsSdk } from "./adsSdk";

/** Memoized so the SDK is initialized once per process, however many times the
 *  consent lifecycle observes `canRequestAds` becoming true. A rejection is
 *  memoized too: initialization failing once in a session will fail the same
 *  way again, and retrying would only delay every later ad request. */
let initialization: Promise<void> | null = null;

/** Initialize the Google Mobile Ads SDK. Call only after UMP reports that ads
 *  may be requested — initializing earlier starts the SDK's own collection
 *  before the user has made a consent decision.
 *
 *  Rejects rather than throws synchronously when the native module is absent;
 *  in practice that path is unreachable, because consent cannot be obtained
 *  without the SDK in the first place. */
export function initializeMobileAdsOnce(): Promise<void> {
  initialization ??= (async () => {
    const sdk = loadAdsSdk();
    if (!sdk) {
      throw adsSdkUnavailableError();
    }
    await sdk.default().initialize();
  })();
  return initialization;
}
