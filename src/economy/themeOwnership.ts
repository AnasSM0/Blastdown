import type { PersistedProfile } from "../services/storage/schemas";
import { catalogEntry, isUnlocked, sanitizeUnlocked } from "./themeCatalog";

// Re-export the catalog-based ownership helpers so callers have one import site.
export { isUnlocked, sanitizeUnlocked, effectiveThemeId } from "./themeCatalog";

export type PurchaseResult =
  | { ok: true; profile: PersistedProfile; reason: "purchased" | "already-owned" }
  | { ok: false; profile: PersistedProfile; reason: "unknown-theme" | "insufficient-bolts" };

/** Attempt to buy a theme. Pure and total: it returns the next profile and a
 *  typed reason, never mutating the input. Deduct-and-unlock happen together, a
 *  balance can never go negative, buying an owned theme is a no-op, and an
 *  unknown id or insufficient Bolts leave the profile unchanged. Idempotency
 *  across rapid double-calls comes from applying this via a functional profile
 *  update (the second call sees the theme already owned). */
export function purchaseTheme(profile: PersistedProfile, themeId: string): PurchaseResult {
  const entry = catalogEntry(themeId);
  if (!entry) {
    return { ok: false, profile, reason: "unknown-theme" };
  }
  if (isUnlocked(profile.unlockedThemeIds, themeId)) {
    return { ok: true, profile, reason: "already-owned" };
  }
  if (profile.bolts < entry.price) {
    return { ok: false, profile, reason: "insufficient-bolts" };
  }
  const nextProfile: PersistedProfile = {
    ...profile,
    bolts: profile.bolts - entry.price,
    unlockedThemeIds: sanitizeUnlocked([...profile.unlockedThemeIds, themeId]),
  };
  return { ok: true, profile: nextProfile, reason: "purchased" };
}
