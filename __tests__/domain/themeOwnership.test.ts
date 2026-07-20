import {
  THEME_CATALOG,
  DEFAULT_UNLOCKED_THEME_IDS,
  isKnownThemeId,
  themePrice,
} from "../../src/economy/themeCatalog";
import {
  sanitizeUnlocked,
  isUnlocked,
  effectiveThemeId,
  purchaseTheme,
} from "../../src/economy/themeOwnership";
import { defaultProfile, type PersistedProfile } from "../../src/services/storage/schemas";

function profileWith(patch: Partial<PersistedProfile>): PersistedProfile {
  return { ...defaultProfile(0), ...patch };
}

describe("theme catalog", () => {
  it("has five themes with Reactor the only default-unlocked one at price 0", () => {
    expect(THEME_CATALOG).toHaveLength(5);
    expect(DEFAULT_UNLOCKED_THEME_IDS).toEqual(["neon-reactor"]);
    expect(themePrice("neon-reactor")).toBe(0);
    expect(THEME_CATALOG.filter((entry) => entry.defaultUnlocked)).toHaveLength(1);
    expect(isKnownThemeId("arctic")).toBe(true);
    expect(isKnownThemeId("nope")).toBe(false);
  });
});

describe("sanitizeUnlocked", () => {
  it("always includes defaults, drops unknown/duplicate, and ignores non-arrays", () => {
    expect(sanitizeUnlocked(undefined)).toEqual(["neon-reactor"]);
    expect(sanitizeUnlocked("garbage")).toEqual(["neon-reactor"]);
    expect(sanitizeUnlocked(["arctic", "arctic", "nope", "neon-reactor"])).toEqual([
      "neon-reactor",
      "arctic",
    ]);
    expect(sanitizeUnlocked([1, {}, null, "magma"])).toEqual(["neon-reactor", "magma"]);
  });
});

describe("isUnlocked / effectiveThemeId", () => {
  it("treats Reactor as always owned and falls back for unowned selections", () => {
    expect(isUnlocked([], "neon-reactor")).toBe(true);
    expect(isUnlocked([], "arctic")).toBe(false);
    expect(isUnlocked(["arctic"], "arctic")).toBe(true);
    expect(effectiveThemeId("arctic", ["neon-reactor"])).toBe("neon-reactor");
    expect(effectiveThemeId("arctic", ["neon-reactor", "arctic"])).toBe("arctic");
  });
});

describe("purchaseTheme", () => {
  it("buys a theme, deducting the exact price and unlocking it", () => {
    const before = profileWith({ bolts: 600, unlockedThemeIds: ["neon-reactor"] });
    const result = purchaseTheme(before, "arctic");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.reason).toBe("purchased");
      expect(result.profile.bolts).toBe(100); // 600 - 500
      expect(result.profile.unlockedThemeIds).toContain("arctic");
    }
    // Input is not mutated.
    expect(before.bolts).toBe(600);
  });

  it("is a no-op for an already-owned theme (no double charge)", () => {
    const before = profileWith({ bolts: 600, unlockedThemeIds: ["neon-reactor", "arctic"] });
    const result = purchaseTheme(before, "arctic");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.reason).toBe("already-owned");
      expect(result.profile.bolts).toBe(600);
    }
  });

  it("rejects insufficient Bolts without mutating the profile", () => {
    const before = profileWith({ bolts: 100, unlockedThemeIds: ["neon-reactor"] });
    const result = purchaseTheme(before, "arctic");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("insufficient-bolts");
      expect(result.profile).toBe(before);
    }
  });

  it("rejects an unknown theme id", () => {
    const before = profileWith({ bolts: 9999 });
    const result = purchaseTheme(before, "does-not-exist");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("unknown-theme");
    }
  });

  it("never lets a rapid double-apply double-charge (functional update)", () => {
    let profile = profileWith({ bolts: 600, unlockedThemeIds: ["neon-reactor"] });
    profile = purchaseTheme(profile, "arctic").profile;
    profile = purchaseTheme(profile, "arctic").profile; // second call sees it owned
    expect(profile.bolts).toBe(100);
    expect(profile.unlockedThemeIds.filter((id) => id === "arctic")).toHaveLength(1);
  });
});
