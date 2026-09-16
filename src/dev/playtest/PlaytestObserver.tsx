import Constants from "expo-constants";
import { useEffect } from "react";
import { Platform } from "react-native";

import { resolveBoardRenderer } from "../../config/renderer";
import { useStorageService } from "../../services/storage/StorageServiceProvider";
import { useGameSession } from "../../state/GameSessionProvider";
import { playtestRecorder } from "./recorderSingleton";

/** Sibling observer: only this null-rendering component subscribes to game
 * context, so diagnostics updates never rerender the gameplay route. */
export function PlaytestObserver(): null {
  const storage = useStorageService();
  const { controller, hasActiveRun, sessionGeneration } = useGameSession();

  useEffect(() => {
    void playtestRecorder.configure(storage, {
      appVersion: Constants.expoConfig?.version ?? "unknown",
      deviceMetadata: {
        platform:
          Platform.OS === "android" || Platform.OS === "ios" || Platform.OS === "web"
            ? Platform.OS
            : "unknown",
        osVersion: String(Platform.Version),
        renderer: resolveBoardRenderer(),
      },
    });
  }, [storage]);

  useEffect(() => {
    try {
      playtestRecorder.observeGame({
        state: controller.state,
        events: controller.lastEvents,
        hasActiveRun,
        sessionGeneration,
      });
    } catch {
      // Evidence is best-effort and must never affect gameplay.
    }
  }, [controller.state, controller.lastEvents, hasActiveRun, sessionGeneration]);

  return null;
}
