import { Stack } from "expo-router";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AdServiceProvider } from "../src/services/ads";
import { StorageServiceProvider } from "../src/services/storage";
import { GameSessionProvider } from "../src/state/GameSessionProvider";
import { ProfileProvider } from "../src/state/ProfileProvider";
import { SettingsProvider } from "../src/state/SettingsProvider";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StorageServiceProvider>
          <SettingsProvider>
            <ProfileProvider>
              <AdServiceProvider>
                <GameSessionProvider>
                  <Stack
                    screenOptions={{
                      headerShown: false,
                    }}
                  />
                </GameSessionProvider>
              </AdServiceProvider>
            </ProfileProvider>
          </SettingsProvider>
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
