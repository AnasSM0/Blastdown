import { createContext, useContext, type ReactNode } from "react";

import { AsyncStorageService, type StorageService } from "./StorageService";

const StorageServiceContext = createContext<StorageService | null>(null);

/** Supplies the app's `StorageService`. Defaults to the AsyncStorage adapter;
 *  tests pass an in-memory service. A single instance for the whole app so all
 *  persistence goes through one seam. */
export function StorageServiceProvider({
  children,
  service = AsyncStorageService,
}: {
  children: ReactNode;
  service?: StorageService;
}) {
  return (
    <StorageServiceContext.Provider value={service}>{children}</StorageServiceContext.Provider>
  );
}

export function useStorageService(): StorageService {
  const service = useContext(StorageServiceContext);
  if (!service) {
    throw new Error("useStorageService must be used within a StorageServiceProvider");
  }
  return service;
}
