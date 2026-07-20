import { createContext, useContext, useMemo, type ReactNode } from "react";

import { effectiveThemeId } from "../economy/themeCatalog";
import { useProfile } from "../state/ProfileProvider";
import { useSettings } from "../state/SettingsProvider";
import { resolveTheme, type ThemePalette } from "./themes";

/** Default is Reactor, so components that read the theme outside a provider
 *  (isolated component tests) get the original palette unchanged. */
const ThemeContext = createContext<ThemePalette>(resolveTheme(undefined));

/** Supplies the active theme palette. The rendered theme is the persisted
 *  selection only if the player owns it (profile.unlockedThemeIds); otherwise
 *  it falls back to Reactor. Switching the setting or unlocking a theme
 *  re-renders every themed surface immediately. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const { profile } = useProfile();
  const theme = useMemo(
    () => resolveTheme(effectiveThemeId(settings.themeId, profile.unlockedThemeIds)),
    [settings.themeId, profile.unlockedThemeIds],
  );
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemePalette {
  return useContext(ThemeContext);
}
