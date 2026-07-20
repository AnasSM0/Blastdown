import AsyncStorage from "@react-native-async-storage/async-storage";

/** The key/value persistence seam (docs/ARCHITECTURE.md "Service adapters").
 *  A thin string store — all schema/versioning/validation lives above it in the
 *  typed *Storage modules. `AsyncStorageService` backs the app;
 *  `createMemoryStorageService` backs tests. Nothing in `src/domain` may import
 *  this: the domain stays pure and never reads storage. */
export interface StorageService {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  multiRemove(keys: readonly string[]): Promise<void>;
}

/** Production adapter over `@react-native-async-storage/async-storage`. */
export const AsyncStorageService: StorageService = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
  multiRemove: (keys) => AsyncStorage.multiRemove([...keys]),
};

export type MemoryStorageService = StorageService & {
  /** Test helper: current backing map contents. */
  readonly store: Map<string, string>;
  /** Test helper: inject a raw value (e.g. corrupt JSON) directly. */
  seed(key: string, value: string): void;
};

/** In-memory `StorageService` for tests: synchronous under the hood, exposed
 *  through the same async contract. Deterministic, no native module. */
export function createMemoryStorageService(
  initial: Record<string, string> = {},
): MemoryStorageService {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    store,
    seed(key, value) {
      store.set(key, value);
    },
    async getItem(key) {
      return store.has(key) ? (store.get(key) as string) : null;
    },
    async setItem(key, value) {
      store.set(key, value);
    },
    async removeItem(key) {
      store.delete(key);
    },
    async multiRemove(keys) {
      for (const key of keys) {
        store.delete(key);
      }
    },
  };
}
