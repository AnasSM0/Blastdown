import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

import { CONSENT_DEBUG_ENABLED, CONSENT_REQUEST_OPTIONS } from "../../config/consent";
import { reportCaught } from "../diagnostics/reportError";
import { INITIAL_CONSENT_STATE } from "./types";
import type { ConsentInfo, ConsentPort, ConsentRequestOptions, ConsentState } from "./types";

export type ConsentController = {
  state: ConsentState;
  /** Re-present the privacy options form. Resolves once the form closes and the
   *  refreshed snapshot has been applied; safe to call when no entry point is
   *  required, in which case UMP simply reports back unchanged. */
  openPrivacyOptions: () => Promise<void>;
  /** Re-run the launch sequence. Exposed for the development reset flow; the
   *  provider already runs it once on mount. */
  refresh: () => Promise<void>;
  /** Clear UMP's stored decision so the first-launch flow can be replayed.
   *  `null` in every build but development — see `CONSENT_DEBUG_ENABLED`. */
  resetConsent: (() => Promise<void>) | null;
};

const ConsentContext = createContext<ConsentController | null>(null);

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown consent error";
}

/** Runs the UMP consent lifecycle once per app launch and exposes the result.
 *
 *  The sequence is: request fresh consent information, present a form if UMP
 *  says one is required, read `canRequestAds`, and only then initialize the
 *  Mobile Ads SDK — once, ever.
 *
 *  Two things it deliberately does not do. It never gates its children: consent
 *  is about ads, gameplay is entirely offline, and a failed or pending consent
 *  request must leave the game fully playable. And it never persists the
 *  decision — UMP owns that state, and a second copy in our storage would go
 *  stale the moment the user changed their mind in the privacy options form. */
export function ConsentProvider({
  children,
  port,
  options = CONSENT_REQUEST_OPTIONS,
  initializeAds,
  debugEnabled = CONSENT_DEBUG_ENABLED,
}: {
  children: ReactNode;
  port: ConsentPort;
  options?: ConsentRequestOptions;
  /** Called at most once, after UMP reports that ads may be requested. */
  initializeAds?: () => Promise<void>;
  debugEnabled?: boolean;
}) {
  const [state, setState] = useState<ConsentState>(INITIAL_CONSENT_STATE);
  const mountedRef = useRef(true);
  // Guards the "initialize once only" rule across every path that can observe
  // `canRequestAds` becoming true: the launch gather, a development refresh, and
  // returning from the privacy options form.
  const initializedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const initializeIfAllowed = useCallback(
    async (info: ConsentInfo) => {
      if (!info.canRequestAds || initializedRef.current || !initializeAds) {
        return;
      }
      // Set before awaiting: two overlapping calls must not both get through.
      initializedRef.current = true;
      try {
        await initializeAds();
      } catch (error) {
        // A failed SDK initialization leaves ads unavailable and nothing else.
        // Not retried — a second attempt in the same session fails the same way.
        reportCaught("reward", error, { stage: "adsInitialize" });
      }
    },
    [initializeAds],
  );

  const apply = useCallback((info: ConsentInfo) => {
    if (!mountedRef.current) {
      return;
    }
    setState({ ...info, phase: "ready", failure: null, errorMessage: null });
  }, []);

  const fail = useCallback((stage: "request" | "form" | "privacyOptions", error: unknown) => {
    reportCaught("reward", error, { stage: `consent_${stage}` });
    if (!mountedRef.current) {
      return;
    }
    // Ads are off on any failure. The rest of the snapshot is left as it was:
    // a privacy entry point that was already required stays required.
    setState((prev) => ({
      ...prev,
      phase: "error",
      canRequestAds: false,
      failure: stage,
      errorMessage: messageOf(error),
    }));
  }, []);

  const refresh = useCallback(async () => {
    if (mountedRef.current) {
      setState((prev) => ({ ...prev, phase: "loading", failure: null, errorMessage: null }));
    }
    let info: ConsentInfo;
    try {
      info = await port.gather(options);
    } catch (error) {
      fail("request", error);
      return;
    }
    apply(info);
    await initializeIfAllowed(info);
  }, [apply, fail, initializeIfAllowed, options, port]);

  const openPrivacyOptions = useCallback(async () => {
    let info: ConsentInfo;
    try {
      info = await port.showPrivacyOptionsForm();
    } catch (error) {
      fail("privacyOptions", error);
      return;
    }
    apply(info);
    // Consent can be granted for the first time from this form, so this is a
    // genuine second chance to initialize — still gated to once ever.
    await initializeIfAllowed(info);
  }, [apply, fail, initializeIfAllowed, port]);

  const resetConsent = useMemo(() => {
    if (!debugEnabled) {
      return null;
    }
    return async () => {
      port.reset();
      await refresh();
    };
  }, [debugEnabled, port, refresh]);

  useEffect(() => {
    void refresh();
    // Launch-once: `refresh` is stable for a given port/options pair, and the
    // provider is mounted once at the root.
  }, [refresh]);

  const value = useMemo<ConsentController>(
    () => ({ state, openPrivacyOptions, refresh, resetConsent }),
    [openPrivacyOptions, refresh, resetConsent, state],
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent(): ConsentController {
  const controller = useContext(ConsentContext);
  if (!controller) {
    throw new Error("useConsent must be used within a ConsentProvider");
  }
  return controller;
}

/** Consent state for trees rendered without a `ConsentProvider` — the game and
 *  results routes under test, for instance. Reports "no consent information",
 *  which keeps ads unavailable rather than assuming permission. */
export function useOptionalConsent(): ConsentController | null {
  return useContext(ConsentContext);
}
