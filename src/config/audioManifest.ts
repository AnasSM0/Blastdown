import type { SfxAssetName } from "../services/audio/types";

export type AudioAssetStatus = "production-candidate" | "legacy-placeholder";

export type SfxAssetDefinition = Readonly<{
  fileName: string;
  channel: "sfx";
  defaultVolume: number;
  minimumRetriggerMs: number;
  pitchVariationAllowed: boolean;
  status: AudioAssetStatus;
  licenseRecord: "AUDIO_LICENSES.md";
}>;

const sfx = (
  fileName: string,
  defaultVolume: number,
  minimumRetriggerMs: number,
  pitchVariationAllowed = false,
  status: AudioAssetStatus = "production-candidate",
): SfxAssetDefinition => ({
  fileName,
  channel: "sfx",
  defaultVolume,
  minimumRetriggerMs,
  pitchVariationAllowed,
  status,
  licenseRecord: "AUDIO_LICENSES.md",
});

/** Production mix metadata. Binary `require` calls stay in sfxAssets.ts so
 * Metro can statically discover them; this manifest owns semantic tuning and
 * auditable file identity. */
export const SFX_AUDIO_MANIFEST: Readonly<Record<SfxAssetName, SfxAssetDefinition>> = {
  button: sfx("button.wav", 0.32, 45),
  selection: sfx("selection.wav", 0.36, 35),
  placement: sfx("placement.wav", 0.55, 30),
  invalid: sfx("invalid.wav", 0.52, 80),
  lineClear: sfx("lineClear.wav", 0.62, 70, true),
  clearDouble: sfx("clearDouble.wav", 0.68, 80, true),
  clearTriple: sfx("clearTriple.wav", 0.74, 90, true),
  clearOverload: sfx("clearOverload.wav", 0.8, 110, true),
  timer2: sfx("timer2.wav", 0.48, 120),
  timer1: sfx("timer1.wav", 0.58, 120),
  defuse: sfx("defuse.wav", 0.7, 100),
  clutch: sfx("clutch.wav", 0.82, 120),
  freeze: sfx("freeze.wav", 0.7, 100),
  defusePowerUp: sfx("defusePowerUp.wav", 0.72, 100),
  explosion: sfx("explosion.wav", 0.9, 160),
  rubbleClear: sfx("rubbleClear.wav", 0.6, 70),
  gameOver: sfx("gameOver.wav", 0.72, 180),
  newBest: sfx("newBest.wav", 0.78, 180),
  revive: sfx("revive.wav", 0, 180, false, "legacy-placeholder"),
};

export const GAMEPLAY_MUSIC_MANIFEST = {
  fileName: "music-loop.wav",
  channel: "music",
  defaultVolume: 0.22,
  bpm: 100,
  bars: 8,
  status: "production-candidate",
  licenseRecord: "AUDIO_LICENSES.md",
} as const;
