import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

import { NoopAnalyticsService } from "./NoopAnalyticsService";
import { recordPlaytestAnalytics } from "../playtest/signal";
import type { AnalyticsEvent, AnalyticsService } from "./types";

/** Defaults to the no-op service, so a tree without a provider (isolated
 *  component tests) still resolves a working — inert — analytics seam and never
 *  throws for a missing provider. */
const AnalyticsContext = createContext<AnalyticsService>(NoopAnalyticsService);

/** Supplies the app's single `AnalyticsService`. Defaults to no-op so the app
 *  and tests run without a vendor SDK; the production analytics phase swaps in
 *  the real adapter here (or a caller passes one via `service`). */
export function AnalyticsServiceProvider({
  children,
  service,
}: {
  children: ReactNode;
  service?: AnalyticsService;
}) {
  const value = useMemo(() => service ?? NoopAnalyticsService, [service]);
  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

export type AnalyticsTracker = {
  /** Fire-and-forget. Wrapped in a guard so a throwing analytics backend can
   *  never propagate into gameplay — a failed `track` is silently dropped. */
  track: (event: AnalyticsEvent) => void;
};

/** The hook screens/hooks use to emit events. The returned `track` is stable
 *  and safe: it reads the current service through a ref and swallows any error
 *  the service raises. Analytics is a side channel — it must never affect the
 *  game, so failures here are intentionally invisible to the caller. */
export function useAnalytics(): AnalyticsTracker {
  const service = useContext(AnalyticsContext);
  const serviceRef = useRef(service);
  useEffect(() => {
    serviceRef.current = service;
  });

  const track = useCallback((event: AnalyticsEvent) => {
    try {
      serviceRef.current.track(event);
    } catch {
      // Analytics must never affect gameplay: drop the event and move on.
    }
    recordPlaytestAnalytics(event);
  }, []);

  return useMemo(() => ({ track }), [track]);
}
