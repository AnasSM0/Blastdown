import { useCallback, useEffect, useMemo, useRef } from "react";

import { useAudioService } from "../services/audio/AudioServiceProvider";
import { feedbackSpec, type SemanticFeedbackCue } from "../services/feedback";
import { useSettings } from "../state/SettingsProvider";
import { useHaptics } from "./useHaptics";

type EmitOptions = { identity?: string; semitones?: number };

function safely(action: () => void): void {
  try {
    action();
  } catch {
    // An injected/native feedback provider is never allowed to affect gameplay.
  }
}

/** Shared imperative feedback entry for UI, interaction, and rewarded outcomes.
 * Callers name meaning; the catalog owns audio asset, priority and haptic. */
export function useFeedback() {
  const audio = useAudioService();
  const haptics = useHaptics();
  const { settings, loaded } = useSettings();
  const sequenceRef = useRef(0);

  useEffect(() => {
    if (loaded) {
      safely(() =>
        audio.configure({
          soundEnabled: settings.soundEnabled,
          musicEnabled: settings.musicEnabled,
        }),
      );
    }
  }, [audio, loaded, settings.musicEnabled, settings.soundEnabled]);

  const emit = useCallback(
    (cue: SemanticFeedbackCue, options: EmitOptions = {}) => {
      const identity = options.identity ?? `imperative:${cue}:${++sequenceRef.current}`;
      if (loaded && settings.soundEnabled) {
        safely(() => audio.play({ identity, cue, semitones: options.semitones }));
      }
      haptics.play(feedbackSpec(cue).haptic);
    },
    [audio, haptics, loaded, settings.soundEnabled],
  );

  const suspend = useCallback(() => safely(() => audio.suspend()), [audio]);
  const resume = useCallback(() => safely(() => audio.resume()), [audio]);

  return useMemo(() => ({ emit, suspend, resume }), [emit, resume, suspend]);
}
