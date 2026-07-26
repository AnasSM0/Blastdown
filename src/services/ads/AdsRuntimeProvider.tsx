import { useEffect, useMemo } from "react";
import type { ReactNode } from "react";

import { REWARDED_AD_UNIT_IDS } from "../../config/ads";
import { areAdsAllowed, useOptionalConsent } from "../consent";
import { AdServiceProvider } from "./AdServiceProvider";
import { isAdsSdkAvailable } from "./adsSdk";
import { createGoogleAdService } from "./GoogleAdService";
import { createGoogleRewardedAdPort } from "./GoogleRewardedAdPort";
import { initializeMobileAdsOnce } from "./mobileAdsRuntime";
import type { AdService } from "./types";

/** Composes the consent gate with the production rewarded provider, and owns
 *  the service's lifetime.
 *
 *  The gate is read through a ref at request time rather than captured, so a
 *  consent decision made mid-session takes effect on the next ad request
 *  without rebuilding the service and throwing away a preloaded ad. */
export function AdsRuntimeProvider({
  children,
  createService,
}: {
  children: ReactNode;
  /** Injection point for tests and for any build that should not construct the
   *  Google service. Called once. */
  createService?: () => AdService;
}) {
  const consent = useOptionalConsent();
  // No consent information means ads are not allowed. Never assume permission.
  const allowed = consent ? areAdsAllowed(consent.state) : false;

  const service = useMemo(() => {
    if (createService) {
      return createService();
    }
    return createGoogleAdService({
      port: createGoogleRewardedAdPort(),
      // No native ad SDK in this binary (Expo Go, or a development build made
      // before it was autolinked) means no ad units, so every placement reports
      // `unavailable` and the port is never touched. The game is unaffected.
      adUnitIds: isAdsSdkAvailable() ? REWARDED_AD_UNIT_IDS : {},
      // Closed until the consent lifecycle says otherwise.
      adsAllowed: false,
      ensureInitialized: initializeMobileAdsOnce,
    });
    // Built once for the life of the provider: rebuilding it would drop any
    // preloaded ad and orphan an in-flight presentation. The gate is pushed in
    // below instead.
  }, [createService]);

  useEffect(() => {
    service.setAdsAllowed?.(allowed);
  }, [allowed, service]);

  useEffect(() => {
    return () => {
      service.dispose?.();
    };
  }, [service]);

  return <AdServiceProvider service={service}>{children}</AdServiceProvider>;
}
