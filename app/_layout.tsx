import { Stack } from "expo-router";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useMemo } from "react";

import { AdServiceProvider } from "../src/services/ads";
import { initializeMobileAdsOnce } from "../src/services/ads/mobileAdsRuntime";
import { AnalyticsServiceProvider } from "../src/services/analytics";
import { ConsentProvider } from "../src/services/consent";
import { createUmpConsentPort } from "../src/services/consent/UmpConsentPort";
import { AnalyticsSessionTracker } from "../src/components/AnalyticsSessionTracker";
import { AppErrorBoundary } from "../src/components/ErrorBoundary";
import { ErrorReporterProvider } from "../src/services/diagnostics";
import { AudioServiceProvider } from "../src/services/audio";
import { createExpoAudioService } from "../src/services/audio/ExpoAudioService";
import { StorageServiceProvider } from "../src/services/storage";
import { GameSessionProvider } from "../src/state/GameSessionProvider";
import { ProfileProvider } from "../src/state/ProfileProvider";
import { SettingsProvider } from "../src/state/SettingsProvider";
import { ThemeProvider } from "../src/ui/ThemeProvider";
import { useAppFonts } from "../src/ui/fonts";

export default function RootLayout() {
  // Loads approved fonts; the tree renders immediately with a system fallback
  // and never blocks startup if loading fails.
  useAppFonts();
  const audioService = useMemo(() => createExpoAudioService(), []);
  // The one place the UMP port is constructed. The consent seam itself never
  // imports the ad SDK, so every other consumer — and every test — stays free of
  // the native module.
  const consentPort = useMemo(() => createUmpConsentPort(), []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StorageServiceProvider>
          <ErrorReporterProvider>
            <AnalyticsServiceProvider>
              <AppErrorBoundary>
                <SettingsProvider>
                  <ProfileProvider>
                    <ThemeProvider>
                      <AudioServiceProvider service={audioService}>
                        {/* Consent runs above the ad service and never gates the
                            tree: the game is fully offline, so a pending or
                            failed consent request must leave it playable. */}
                        <ConsentProvider port={consentPort} initializeAds={initializeMobileAdsOnce}>
                          <AdServiceProvider>
                            <GameSessionProvider>
                              <AnalyticsSessionTracker />
                              <Stack
                                screenOptions={{
                                  headerShown: false,
                                }}
                              />
                            </GameSessionProvider>
                          </AdServiceProvider>
                        </ConsentProvider>
                      </AudioServiceProvider>
                    </ThemeProvider>
                  </ProfileProvider>
                </SettingsProvider>
              </AppErrorBoundary>
            </AnalyticsServiceProvider>
          </ErrorReporterProvider>
        </StorageServiceProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
