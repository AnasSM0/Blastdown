import { useCallback, useEffect, useMemo, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

import type { GameEvent } from "../domain/events";
import type { GameState } from "../domain/gameTypes";
import { useAudioService } from "../services/audio/AudioServiceProvider";
import { resolveTurnFeedback } from "../services/feedback";
import { useSettings } from "../state/SettingsProvider";
import { useFeedback } from "./useFeedback";

type ObservedTurn = { sessionGeneration: number; turn: number };

function safely(action: () => void): void {
  try {
    action();
  } catch {
    // Feedback lifecycle must degrade to silence, never affect gameplay.
  }
}

/** Drives committed feedback and audio lifecycle from authoritative session
 * inputs. Mount/hydration establishes a baseline and emits nothing; only a
 * later turn in the same generation can produce a cue. */
export function useGameFeedback({
  sessionGeneration,
  turn,
  events,
  status,
  paused,
  combo,
  score,
  previousBest,
}: {
  sessionGeneration: number;
  turn: number;
  events: readonly GameEvent[];
  status: GameState["status"];
  paused: boolean;
  combo: number;
  score: number;
  previousBest: number;
}) {
  const audio = useAudioService();
  const { emit, suspend, resume } = useFeedback();
  const { settings, loaded } = useSettings();
  const observedRef = useRef<ObservedTurn>({ sessionGeneration, turn });
  const stateRef = useRef({ loaded, musicEnabled: settings.musicEnabled, paused, status });
  useEffect(() => {
    stateRef.current = { loaded, musicEnabled: settings.musicEnabled, paused, status };
  });

  useEffect(() => {
    const previous = observedRef.current;
    observedRef.current = { sessionGeneration, turn };
    if (sessionGeneration !== previous.sessionGeneration || turn <= previous.turn) return;

    const resolved = resolveTurnFeedback({
      sessionGeneration,
      turn,
      events,
      combo,
      newBest: events.some((event) => event.type === "gameOver") && score > previousBest,
    });
    if (resolved) {
      emit(resolved.cue, {
        identity: resolved.identity,
        semitones: resolved.semitones,
      });
    }
  }, [combo, emit, events, previousBest, score, sessionGeneration, turn]);

  useEffect(() => {
    if (!loaded) return;
    if (!settings.musicEnabled) {
      safely(() => audio.stopMusic());
    } else if (paused || status === "gameOver") {
      safely(() => audio.pauseMusic());
    } else {
      safely(() => audio.startMusic());
    }
  }, [audio, loaded, paused, settings.musicEnabled, status]);

  const interrupt = useCallback(() => suspend(), [suspend]);
  const restore = useCallback(() => {
    resume();
    const current = stateRef.current;
    if (
      current.loaded &&
      current.musicEnabled &&
      !current.paused &&
      current.status !== "gameOver"
    ) {
      safely(() => audio.startMusic());
    }
  }, [audio, resume]);

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next === "background" || next === "inactive") {
        interrupt();
      } else if (next === "active") {
        restore();
      }
    };
    const subscription = AppState.addEventListener("change", onChange);
    return () => subscription.remove();
  }, [interrupt, restore]);

  useEffect(
    () => () => {
      safely(() => audio.stopAll());
    },
    [audio],
  );

  return useMemo(() => ({ emit, interrupt, restore }), [emit, interrupt, restore]);
}
