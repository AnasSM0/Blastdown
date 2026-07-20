import { DEFAULT_THEME_ID } from "../ui/themes";

/** Authoritative theme catalog: the single source of truth for theme ids,
 *  display names, Bolt prices, and default-unlocked status. UI screens and the
 *  ownership service read prices/names from here — never hardcode them in a
 *  component. Color palettes live in src/ui/themes.ts, keyed by the same ids. */
export type ThemeCatalogEntry = {
  id: string;
  name: string;
  /** Bolt price to unlock. 0 for default-unlocked themes. */
  price: number;
  /** True for themes every player owns from the start (Reactor). */
  defaultUnlocked: boolean;
};

/** Prices are the Phase 5A implementation values (BUILD_SPEC.md does not fix a
 *  theme price list) — see the 2026-07-21 Decisions entry. */
export const THEME_CATALOG: readonly ThemeCatalogEntry[] = [
  { id: DEFAULT_THEME_ID, name: "Reactor", price: 0, defaultUnlocked: true },
  { id: "arctic", name: "Arctic", price: 500, defaultUnlocked: false },
  { id: "magma", name: "Magma", price: 500, defaultUnlocked: false },
  { id: "void", name: "Void", price: 750, defaultUnlocked: false },
  { id: "solar", name: "Solar", price: 750, defaultUnlocked: false },
];

const CATALOG_BY_ID = new Map(THEME_CATALOG.map((entry) => [entry.id, entry]));

/** Theme ids that every profile owns from creation (currently just Reactor). */
export const DEFAULT_UNLOCKED_THEME_IDS: readonly string[] = THEME_CATALOG.filter(
  (entry) => entry.defaultUnlocked,
).map((entry) => entry.id);

export function isKnownThemeId(id: string): boolean {
  return CATALOG_BY_ID.has(id);
}

export function catalogEntry(id: string): ThemeCatalogEntry | undefined {
  return CATALOG_BY_ID.get(id);
}

export function themePrice(id: string): number {
  return CATALOG_BY_ID.get(id)?.price ?? 0;
}

/** Normalize a persisted/loaded unlocked-theme list: drop unknown and duplicate
 *  ids, ignore non-arrays, and always guarantee the default-unlocked themes are
 *  present. Deterministic order (defaults first). Pure and total — corrupt data
 *  becomes a safe list. Lives here (not the ownership service) so the
 *  persistence layer can validate without importing profile types. */
export function sanitizeUnlocked(ids: unknown): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of DEFAULT_UNLOCKED_THEME_IDS) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  if (Array.isArray(ids)) {
    for (const candidate of ids) {
      if (typeof candidate === "string" && isKnownThemeId(candidate) && !seen.has(candidate)) {
        seen.add(candidate);
        out.push(candidate);
      }
    }
  }
  return out;
}

/** True when the player owns a theme: default-unlocked themes are always owned;
 *  others must be in the unlocked list. */
export function isUnlocked(unlockedIds: readonly string[], themeId: string): boolean {
  if (CATALOG_BY_ID.get(themeId)?.defaultUnlocked) {
    return true;
  }
  return unlockedIds.includes(themeId);
}

/** The theme id to actually render: the selection if owned, else Reactor. */
export function effectiveThemeId(selectedId: string, unlockedIds: readonly string[]): string {
  return isUnlocked(unlockedIds, selectedId) ? selectedId : DEFAULT_THEME_ID;
}
