import type { SfxAssetName } from "./types";

/** Bundled sources for each effect and the music loop. All clips are original
 *  works generated for BlastDown (CC0 / project-owned) — see
 *  assets/licenses/AUDIO_LICENSES.md. Kept isolated here so only the real
 *  audio service imports the binary assets; tests use the no-op service. */
export const SFX_SOURCES: Record<SfxAssetName, number> = {
  selection: require("../../../assets/audio/selection.wav"),
  placement: require("../../../assets/audio/placement.wav"),
  invalid: require("../../../assets/audio/invalid.wav"),
  lineClear: require("../../../assets/audio/lineClear.wav"),
  clearDouble: require("../../../assets/audio/clearDouble.wav"),
  clearTriple: require("../../../assets/audio/clearTriple.wav"),
  clearOverload: require("../../../assets/audio/clearOverload.wav"),
  timer2: require("../../../assets/audio/timer2.wav"),
  timer1: require("../../../assets/audio/timer1.wav"),
  defuse: require("../../../assets/audio/defuse.wav"),
  clutch: require("../../../assets/audio/clutch.wav"),
  defusePowerUp: require("../../../assets/audio/defusePowerUp.wav"),
  explosion: require("../../../assets/audio/explosion.wav"),
  rubbleClear: require("../../../assets/audio/rubbleClear.wav"),
  freeze: require("../../../assets/audio/freeze.wav"),
  revive: require("../../../assets/audio/revive.wav"),
  gameOver: require("../../../assets/audio/gameOver.wav"),
  newBest: require("../../../assets/audio/newBest.wav"),
  button: require("../../../assets/audio/button.wav"),
};

export const MUSIC_SOURCE: number = require("../../../assets/audio/music-loop.wav");
