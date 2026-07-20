import { useCallback, useMemo } from "react";

import { useAudioService } from "../services/audio/AudioServiceProvider";
import type { SfxName } from "../services/audio/types";
import { useSettings } from "../state/SettingsProvider";

export type GameAudio = {
  /** Play a UI/game effect, honoring the persisted sound setting. A no-op when
   *  sound is off, so callers never branch on the setting themselves. */
  playSfx: (name: SfxName) => void;
  /** Whether sound effects are currently enabled (persisted). */
  soundEnabled: boolean;
  /** Whether music is currently enabled (persisted). */
  musicEnabled: boolean;
};

/** UI-facing audio: a single settings-gated entry point so screens and
 *  components stay independent from expo-audio and from the settings shape. */
export function useAudio(): GameAudio {
  const service = useAudioService();
  const { settings } = useSettings();
  const soundEnabled = settings.soundEnabled;
  const musicEnabled = settings.musicEnabled;

  const playSfx = useCallback(
    (name: SfxName) => {
      if (soundEnabled) {
        service.playSfx(name);
      }
    },
    [service, soundEnabled],
  );

  return useMemo(
    () => ({ playSfx, soundEnabled, musicEnabled }),
    [playSfx, soundEnabled, musicEnabled],
  );
}
