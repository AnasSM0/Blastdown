import { ALL_STORAGE_KEYS } from "./keys";
import type { StorageService } from "./StorageService";

/** Development-only helper: wipe every BlastDown-owned key (active run,
 *  profile, settings) so a clean-slate launch can be reproduced. Guarded by
 *  `__DEV__` — a no-op in production builds so it can never clear a real
 *  player's progress. Only BlastDown's own namespaced keys are removed. */
export async function resetAllStorage(storage: StorageService): Promise<void> {
  if (typeof __DEV__ !== "undefined" && !__DEV__) {
    return;
  }
  await storage.multiRemove(ALL_STORAGE_KEYS);
}
