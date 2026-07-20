/** The restrained SFX vocabulary (BUILD_SPEC.md §20.3). Each maps to one
 *  short, self-authored (CC0) clip in assets/audio. Triggered from typed
 *  game/UI events — never inferred from board state. */
export type SfxName =
  | "selection"
  | "placement"
  | "invalid"
  | "lineClear"
  | "defuse"
  | "explosion"
  | "rubbleClear"
  | "freeze"
  | "revive"
  | "gameOver"
  | "button";

/** The audio seam (docs/ARCHITECTURE.md "Service adapters"). Screens and
 *  components talk to this, never to expo-audio directly. `ExpoAudioService`
 *  backs the app; `NoOpAudioService` backs tests. Every method is best-effort
 *  and must never throw into gameplay. */
export interface AudioService {
  /** Play a one-shot effect from its start (restarts if already playing). */
  playSfx(name: SfxName): void;
  /** Start the looping music bed (idempotent — a second call does not restart
   *  a loop that is already playing). */
  startMusic(): void;
  /** Pause the music loop, keeping its position (AppState background). */
  pauseMusic(): void;
  /** Resume a paused music loop. */
  resumeMusic(): void;
  /** Stop and rewind the music loop (leaving gameplay / unmount). */
  stopMusic(): void;
  /** Release native players. */
  release(): void;
}
