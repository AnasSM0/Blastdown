import { createMemoryStorageService } from "../../src/services/storage/StorageService";
import { loadProfile, saveProfile } from "../../src/services/storage/progressStorage";
import { loadSettings, saveSettings } from "../../src/services/storage/settingsStorage";
import { defaultProfile, defaultSettings } from "../../src/services/storage/schemas";

const NOW = 1_752_800_000_000;

describe("profile storage", () => {
  it("returns a default profile when none is stored", async () => {
    const storage = createMemoryStorageService();
    expect(await loadProfile(storage, NOW)).toEqual(defaultProfile(NOW));
  });

  it("round-trips a saved profile", async () => {
    const storage = createMemoryStorageService();
    const profile = { ...defaultProfile(NOW), bestScore: 9000, bolts: 120, totalRuns: 7 };
    await saveProfile(storage, profile);
    const loaded = await loadProfile(storage, NOW);
    expect(loaded.bestScore).toBe(9000);
    expect(loaded.bolts).toBe(120);
    expect(loaded.totalRuns).toBe(7);
  });
});

describe("settings storage", () => {
  it("returns default settings when none is stored", async () => {
    const storage = createMemoryStorageService();
    expect(await loadSettings(storage)).toEqual(defaultSettings());
  });

  it("round-trips saved settings", async () => {
    const storage = createMemoryStorageService();
    await saveSettings(storage, {
      ...defaultSettings(),
      soundEnabled: false,
      reducedMotionOverride: true,
      themeId: "midnight",
    });
    const loaded = await loadSettings(storage);
    expect(loaded.soundEnabled).toBe(false);
    expect(loaded.reducedMotionOverride).toBe(true);
    expect(loaded.themeId).toBe("midnight");
  });
});
