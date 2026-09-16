import { createContext, useContext, type ReactNode } from "react";
import { resolveTheme, type ThemePalette } from "./themes";

/** Default is Reactor, so components that read the theme outside a provider
 *  (isolated component tests) get the original palette unchanged. */
const ThemeContext = createContext<ThemePalette>(resolveTheme(undefined));

/** Supplies the single canonical V1 palette. Legacy theme fields remain
 *  parseable in storage but cannot change production presentation. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeContext.Provider value={resolveTheme(undefined)}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemePalette {
  return useContext(ThemeContext);
}
