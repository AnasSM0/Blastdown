/** AsyncStorage keys for BlastDown's persisted data. All namespaced so a
 *  device-wide clear (dev reset) can enumerate them, and so unrelated keys are
 *  never touched. Never store secrets or production ad data here. */
export const STORAGE_KEYS = {
  activeRun: "blastdown/active-run/v1",
  profile: "blastdown/profile/v1",
  settings: "blastdown/settings/v1",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/** Every key BlastDown owns — used by the dev reset utility. */
export const ALL_STORAGE_KEYS: readonly StorageKey[] = Object.values(STORAGE_KEYS);
