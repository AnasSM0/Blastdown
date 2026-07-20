import { createContext, useContext, useMemo, type ReactNode } from "react";

import { useSettings } from "../state/SettingsProvider";
import { resolveTheme, type ThemePalette } from "./themes";

/** Default is Reactor, so components that read the theme outside a provider
 *  (isolated component tests) get the original palette unchanged. */
const ThemeContext = createContext<ThemePalette>(resolveTheme(undefined));

/** Supplies the active theme palette from the persisted `settings.themeId`.
 *  Switching the setting re-renders every themed surface immediately. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const theme = useMemo(() => resolveTheme(settings.themeId), [settings.themeId]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemePalette {
  return useContext(ThemeContext);
}
