import { createContext, useContext, useMemo, type ReactNode } from "react";

import { createDefaultAdService } from "./defaultAdService";
import type { AdService } from "./types";

const AdServiceContext = createContext<AdService | null>(null);

/** Supplies the app's single `AdService`. Production native builds use Google
 *  Mobile Ads; development/tests use the deterministic mock. Tests may inject
 *  a service for an individual tree. */
export function AdServiceProvider({
  children,
  service,
}: {
  children: ReactNode;
  service?: AdService;
}) {
  // A caller-supplied service is stable by contract; the selected default is
  // created once per provider mount.
  const value = useMemo(() => service ?? createDefaultAdService(), [service]);
  return <AdServiceContext.Provider value={value}>{children}</AdServiceContext.Provider>;
}

export function useAdService(): AdService {
  const service = useContext(AdServiceContext);
  if (!service) {
    throw new Error("useAdService must be used within an AdServiceProvider");
  }
  return service;
}
