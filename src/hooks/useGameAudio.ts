import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

import type { GameEvent } from "../domain/events";
import { useAudioService } from "../services/audio/AudioServiceProvider";
import type { SfxName } from "../services/audio/types";
import { useSettings } from "../state/SettingsProvider";

/** Typed event → effect, for events that occur on a placement (turn bump).
 *  Selection / invalid / button, and the rewarded freeze / defuse / revive
 *  cues, are fired imperatively (they change no turn), so they are not here. */
const SFX_FOR_EVENT: Partial<Record<GameEvent["type"], SfxName>> = {
  piecePlaced: "placement",
  linesCleared: "lineClear",
  pieceDefused: "defuse",
  explosionStarted: "explosion",
  rubbleCleared: "rubbleClear",
  gameOver: "gameOver",
};

function isGameOver(status: string): boolean {
  return status === "gameOver";
}

/** Drives audio from the domain's own event stream and status. Sound effects
 *  play once per turn (keyed on the turn counter, never inferred from board
 *  state), gated by the persisted sound setting. Music loops while mounted,
 *  gated by the music setting, pauses on app background and on game over, and
 *  stops on unmount (leaving gameplay). It computes no gameplay. */
export function useGameAudio({
  turn,
  events,
  status,
}: {
  turn: number;
  events: readonly GameEvent[];
  status: string;
}): void {
  const service = useAudioService();
  const { settings, loaded } = useSettings();
  const soundEnabled = settings.soundEnabled;
  const musicEnabled = settings.musicEnabled;

  // Latest values mirrored into refs (written in an effect) so the turn and
  // AppState effects read current data without re-subscribing.
  const eventsRef = useRef(events);
  const soundRef = useRef(soundEnabled);
  const musicEnabledRef = useRef(musicEnabled);
  const statusRef = useRef(status);
  useEffect(() => {
    eventsRef.current = events;
    soundRef.current = soundEnabled;
    musicEnabledRef.current = musicEnabled;
    statusRef.current = status;
  });

  // Sound effects: exactly once per new turn.
  const lastTurnRef = useRef(turn);
  useEffect(() => {
    if (turn <= lastTurnRef.current) {
      lastTurnRef.current = turn;
      return;
    }
    lastTurnRef.current = turn;
    if (!soundRef.current) {
      return;
    }
    const played = new Set<SfxName>();
    for (const event of eventsRef.current) {
      const name = SFX_FOR_EVENT[event.type];
      if (name && !played.has(name)) {
        played.add(name);
        service.playSfx(name);
      }
    }
  }, [turn, service]);

  // Music start/stop follows the music setting only (not status), so toggling
  // sound or changing turns never restarts the loop. Gated on settings having
  // loaded so the default never briefly starts music the player disabled.
  useEffect(() => {
    if (!loaded) {
      return;
    }
    if (musicEnabled) {
      service.startMusic();
    } else {
      service.stopMusic();
    }
  }, [loaded, musicEnabled, service]);

  // Pause the loop during game over; resume when back in play.
  useEffect(() => {
    if (!loaded || !musicEnabledRef.current) {
      return;
    }
    if (isGameOver(status)) {
      service.pauseMusic();
    } else {
      service.resumeMusic();
    }
  }, [loaded, status, service]);

  // Pause on background, resume on foreground (unless music is off / game over).
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next === "background" || next === "inactive") {
        service.pauseMusic();
      } else if (next === "active" && musicEnabledRef.current && !isGameOver(statusRef.current)) {
        service.resumeMusic();
      }
    };
    const subscription = AppState.addEventListener("change", onChange);
    return () => subscription.remove();
  }, [service]);

  // Stop the loop when leaving gameplay (Home / unmount).
  useEffect(() => () => service.stopMusic(), [service]);
}
