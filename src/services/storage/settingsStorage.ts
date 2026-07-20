import { STORAGE_KEYS } from "./keys";
import { parseSettings, type PersistedSettings } from "./schemas";
import type { StorageService } from "./StorageService";

/** Load settings, always returning valid settings (defaults on any problem). */
export async function loadSettings(storage: StorageService): Promise<PersistedSettings> {
  return parseSettings(await storage.getItem(STORAGE_KEYS.settings));
}

export async function saveSettings(
  storage: StorageService,
  settings: PersistedSettings,
): Promise<void> {
  await storage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
}
