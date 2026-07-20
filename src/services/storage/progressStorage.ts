import { STORAGE_KEYS } from "./keys";
import { parseProfile, type PersistedProfile } from "./schemas";
import type { StorageService } from "./StorageService";

/** Load the player profile, always returning a valid profile (defaults on
 *  missing/corrupt/incompatible data). */
export async function loadProfile(storage: StorageService, now: number): Promise<PersistedProfile> {
  return parseProfile(await storage.getItem(STORAGE_KEYS.profile), now);
}

/** Persist the whole profile. Small and infrequent (once per run settlement /
 *  tutorial toggle), so no coalescing writer is needed. */
export async function saveProfile(
  storage: StorageService,
  profile: PersistedProfile,
): Promise<void> {
  await storage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
}
