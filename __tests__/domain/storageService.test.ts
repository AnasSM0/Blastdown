import { createMemoryStorageService } from "../../src/services/storage/StorageService";
import { resetAllStorage } from "../../src/services/storage/devReset";
import { ALL_STORAGE_KEYS, STORAGE_KEYS } from "../../src/services/storage/keys";

describe("createMemoryStorageService", () => {
  it("stores, reads, and removes values", async () => {
    const storage = createMemoryStorageService();
    expect(await storage.getItem("k")).toBeNull();
    await storage.setItem("k", "v");
    expect(await storage.getItem("k")).toBe("v");
    await storage.removeItem("k");
    expect(await storage.getItem("k")).toBeNull();
  });

  it("seeds raw values and multi-removes", async () => {
    const storage = createMemoryStorageService();
    storage.seed(STORAGE_KEYS.profile, "{}");
    storage.seed(STORAGE_KEYS.settings, "{}");
    await storage.multiRemove([STORAGE_KEYS.profile, STORAGE_KEYS.settings]);
    expect(await storage.getItem(STORAGE_KEYS.profile)).toBeNull();
    expect(await storage.getItem(STORAGE_KEYS.settings)).toBeNull();
  });
});

describe("resetAllStorage", () => {
  it("clears every BlastDown-owned key", async () => {
    const storage = createMemoryStorageService();
    for (const key of ALL_STORAGE_KEYS) {
      storage.seed(key, "x");
    }
    // Leave an unrelated key untouched.
    storage.seed("other/app/key", "keep");

    await resetAllStorage(storage);

    for (const key of ALL_STORAGE_KEYS) {
      expect(await storage.getItem(key)).toBeNull();
    }
    expect(await storage.getItem("other/app/key")).toBe("keep");
  });
});
