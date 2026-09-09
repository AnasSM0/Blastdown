import type { FeedbackRequest } from "../feedback/types";

/** The restrained SFX vocabulary (BUILD_SPEC.md §20.3). Each maps to one
 *  short, self-authored (CC0) clip in assets/audio. Triggered from typed
 *  game/UI events — never inferred from board state. */
export type SfxAssetName =
  | "selection"
  | "placement"
  | "invalid"
  | "lineClear"
  | "clearDouble"
  | "clearTriple"
  | "clearOverload"
  | "timer2"
  | "timer1"
  | "defuse"
  | "clutch"
  | "defusePowerUp"
  | "explosion"
  | "rubbleClear"
  | "freeze"
  | "revive"
  | "gameOver"
  | "newBest"
  | "button";

export type AudioChannelSettings = {
  soundEnabled: boolean;
  musicEnabled: boolean;
};

/** The audio seam (docs/ARCHITECTURE.md "Service adapters"). Screens and
 *  components talk to this, never to expo-audio directly. `ExpoAudioService`
 *  backs the app; `NoOpAudioService` backs tests. Every method is best-effort
 *  and must never throw into gameplay. */
export interface AudioService {
  /** Warm the finite manifest. Repeated calls are idempotent. */
  preload(): void;
  /** Apply live settings at the adapter boundary as a second safety gate. */
  configure(settings: AudioChannelSettings): void;
  /** Play one semantic request. Identity, priority, pitch and voice policy are
   * enforced inside the adapter. */
  play(request: FeedbackRequest): void;
  /** Start the looping music bed (idempotent — a second call does not restart
   *  a loop that is already playing). */
  startMusic(): void;
  /** Pause the music loop, keeping its position (AppState background). */
  pauseMusic(): void;
  /** Resume a paused music loop. */
  resumeMusic(): void;
  /** Stop and rewind the music loop (leaving gameplay / unmount). */
  stopMusic(): void;
  /** Pause all native audio for backgrounding or native rewarded UI. */
  suspend(): void;
  /** Reactivate the audio engine. Callers decide whether music should resume. */
  resume(): void;
  /** Stop all SFX and music without releasing reusable players. */
  stopAll(): void;
  /** Release native players. */
  release(): void;
}
