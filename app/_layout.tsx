import { Stack } from "expo-router";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AdServiceProvider } from "../src/services/ads";
import { GameSessionProvider } from "../src/state/GameSessionProvider";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AdServiceProvider>
          <GameSessionProvider>
            <Stack
              screenOptions={{
                headerShown: false,
              }}
            />
          </GameSessionProvider>
        </AdServiceProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
