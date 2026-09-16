import { Stack } from "expo-router";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useMemo } from "react";

import { AdServiceProvider } from "../src/services/ads";
import { AnalyticsServiceProvider } from "../src/services/analytics";
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
import { resolvePlaytestObserver } from "../src/dev/playtest/playtestEntry";

const PlaytestObserver = resolvePlaytestObserver();

export default function RootLayout() {
  // Loads approved fonts; the tree renders immediately with a system fallback
  // and never blocks startup if loading fails.
  useAppFonts();
  const audioService = useMemo(() => createExpoAudioService(), []);

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
                        <AdServiceProvider>
                          <GameSessionProvider>
                            {PlaytestObserver ? <PlaytestObserver /> : null}
                            <AnalyticsSessionTracker />
                            <Stack
                              screenOptions={{
                                headerShown: false,
                              }}
                            />
                          </GameSessionProvider>
                        </AdServiceProvider>
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
