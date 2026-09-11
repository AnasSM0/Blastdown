// Import individual faces rather than the package barrels. The generated
// barrels statically require every weight/style (and the package aggregate also
// pulls Material Symbols), so Metro otherwise packages dozens of unused fonts.
import { Geist_400Regular } from "@expo-google-fonts/geist/400Regular";
import { Geist_600SemiBold } from "@expo-google-fonts/geist/600SemiBold";
import { JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono/500Medium";
import { JetBrainsMono_600SemiBold } from "@expo-google-fonts/jetbrains-mono/600SemiBold";
import { JetBrainsMono_700Bold } from "@expo-google-fonts/jetbrains-mono/700Bold";
import { useFonts } from "expo-font";

/** Loads the approved font faces (Geist + JetBrains Mono, both SIL OFL — see
 *  assets/licenses). Returns whether they have loaded. The caller renders
 *  immediately regardless: until a face loads, or if loading fails, React
 *  Native draws the system fallback for that family name, so startup is never
 *  blocked (docs/STYLE_GUIDE.md typography). The font family strings live in
 *  src/ui/theme (`fonts`) so nothing but this module imports the binaries. */
export function useAppFonts(): boolean {
  const [loaded] = useFonts({
    Geist_400Regular,
    Geist_600SemiBold,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
  });
  return loaded;
}
