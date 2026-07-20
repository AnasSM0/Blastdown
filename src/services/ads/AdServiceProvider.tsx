import { createContext, useContext, useMemo, type ReactNode } from "react";

import { createMockAdService } from "./MockAdService";
import type { AdService } from "./types";

const AdServiceContext = createContext<AdService | null>(null);

/** Supplies the app's single `AdService`. Defaults to the mock so the app and
 *  tests run without a real ad SDK; the real-ads phase swaps in the native
 *  implementation here (or passes one via `service` for a specific tree). */
export function AdServiceProvider({
  children,
  service,
}: {
  children: ReactNode;
  service?: AdService;
}) {
  // A caller-supplied service is stable by contract; the default mock is created
  // once per provider mount.
  const value = useMemo(() => service ?? createMockAdService(), [service]);
  return <AdServiceContext.Provider value={value}>{children}</AdServiceContext.Provider>;
}

export function useAdService(): AdService {
  const service = useContext(AdServiceContext);
  if (!service) {
    throw new Error("useAdService must be used within an AdServiceProvider");
  }
  return service;
}
