/// <reference types="node" />

import fs from "node:fs";
import path from "node:path";

import { GAMEPLAY_MUSIC_MANIFEST, SFX_AUDIO_MANIFEST } from "../../src/config/audioManifest";
import { feedbackSpec, type SemanticFeedbackCue } from "../../src/services/feedback";

type WavInfo = {
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  durationSeconds: number;
  peakDb: number;
  rmsDb: number;
  leadingSilenceMs: number;
  trailingSilenceMs: number;
  firstSamples: number[];
  lastSamples: number[];
};

function inspectWav(filePath: string): WavInfo {
  const bytes = fs.readFileSync(filePath);
  expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
  expect(bytes.toString("ascii", 8, 12)).toBe("WAVE");

  let offset = 12;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let pcm = Buffer.alloc(0);
  while (offset + 8 <= bytes.length) {
    const id = bytes.toString("ascii", offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (id === "fmt ") {
      expect(bytes.readUInt16LE(start)).toBe(1);
      channels = bytes.readUInt16LE(start + 2);
      sampleRate = bytes.readUInt32LE(start + 4);
      bitsPerSample = bytes.readUInt16LE(start + 14);
    } else if (id === "data") {
      pcm = bytes.subarray(start, start + size);
    }
    offset = start + size + (size % 2);
  }

  expect(bitsPerSample).toBe(16);
  const samples = Array.from(
    { length: pcm.length / 2 },
    (_, index) => pcm.readInt16LE(index * 2) / 32768,
  );
  let peak = 0;
  let squared = 0;
  let firstAudible = -1;
  let lastAudible = -1;
  samples.forEach((sample, index) => {
    const magnitude = Math.abs(sample);
    peak = Math.max(peak, magnitude);
    squared += sample * sample;
    if (magnitude >= 0.001) {
      if (firstAudible < 0) firstAudible = index;
      lastAudible = index;
    }
  });
  const frames = samples.length / channels;
  return {
    channels,
    sampleRate,
    bitsPerSample,
    durationSeconds: frames / sampleRate,
    peakDb: 20 * Math.log10(peak || 1e-9),
    rmsDb: 10 * Math.log10(squared / samples.length || 1e-9),
    leadingSilenceMs: (Math.max(0, firstAudible) / channels / sampleRate) * 1000,
    trailingSilenceMs:
      (Math.max(0, samples.length - 1 - lastAudible) / channels / sampleRate) * 1000,
    firstSamples: samples.slice(0, channels),
    lastSamples: samples.slice(-channels),
  };
}

const expectedCueAssets: Record<SemanticFeedbackCue, keyof typeof SFX_AUDIO_MANIFEST> = {
  uiTap: "button",
  piecePickup: "selection",
  validPlacement: "placement",
  invalidPlacement: "invalid",
  clearSingle: "lineClear",
  clearDouble: "clearDouble",
  clearTriple: "clearTriple",
  clearOverload: "clearOverload",
  timerWarning2: "timer2",
  timerWarning1: "timer1",
  naturalDefuse: "defuse",
  clutchDefuse: "clutch",
  freezeApplied: "freeze",
  defusePowerUpApplied: "defusePowerUp",
  explosion: "explosion",
  rubbleCleared: "rubbleClear",
  gameOver: "gameOver",
  newBest: "newBest",
  rewardFailure: "invalid",
};

describe("production audio manifest", () => {
  it("maps every semantic cue to its deliberate production asset", () => {
    for (const [cue, asset] of Object.entries(expectedCueAssets) as [
      SemanticFeedbackCue,
      keyof typeof SFX_AUDIO_MANIFEST,
    ][]) {
      expect(feedbackSpec(cue).asset).toBe(asset);
    }
  });

  it("references present, trimmed, phone-appropriate PCM SFX", () => {
    for (const [asset, definition] of Object.entries(SFX_AUDIO_MANIFEST)) {
      const filePath = path.resolve(__dirname, "../../assets/audio", definition.fileName);
      expect(fs.existsSync(filePath)).toBe(true);
      if (asset === "revive") continue;

      const info = inspectWav(filePath);
      expect(definition.status).toBe("production-candidate");
      expect(info.channels).toBe(1);
      expect(info.sampleRate).toBe(44_100);
      expect(info.durationSeconds).toBeGreaterThanOrEqual(0.045);
      expect(info.durationSeconds).toBeLessThanOrEqual(0.9);
      expect(info.leadingSilenceMs).toBeLessThan(8);
      expect(info.trailingSilenceMs).toBeLessThan(25);
      expect(info.peakDb).toBeGreaterThanOrEqual(-8);
      expect(info.peakDb).toBeLessThanOrEqual(-1);
    }
  });

  it("ships one bounded seamless 100 BPM gameplay loop", () => {
    const filePath = path.resolve(
      __dirname,
      "../../assets/audio",
      GAMEPLAY_MUSIC_MANIFEST.fileName,
    );
    const info = inspectWav(filePath);

    expect(GAMEPLAY_MUSIC_MANIFEST.bpm).toBe(100);
    expect(GAMEPLAY_MUSIC_MANIFEST.status).toBe("production-candidate");
    expect(info.channels).toBe(2);
    expect(info.sampleRate).toBe(32_000);
    expect(info.durationSeconds).toBeCloseTo(19.2, 4);
    expect(info.peakDb).toBeGreaterThanOrEqual(-12);
    expect(info.peakDb).toBeLessThanOrEqual(-5);
    expect(info.rmsDb).toBeLessThan(-14);
    info.firstSamples.forEach((sample, index) => {
      expect(Math.abs(sample - info.lastSamples[index])).toBeLessThan(0.025);
    });
  });

  it("keeps the complete audio package below four MiB", () => {
    const totalBytes = fs
      .readdirSync(path.resolve(__dirname, "../../assets/audio"))
      .filter((name) => name.endsWith(".wav"))
      .reduce(
        (total, name) =>
          total + fs.statSync(path.resolve(__dirname, "../../assets/audio", name)).size,
        0,
      );
    expect(totalBytes).toBeLessThan(4 * 1024 * 1024);
  });

  it("licenses every manifest asset and keeps legacy Revive out of V1 semantics", () => {
    const licenses = fs.readFileSync(
      path.resolve(__dirname, "../../assets/licenses/AUDIO_LICENSES.md"),
      "utf8",
    );
    const filenames = [
      ...Object.values(SFX_AUDIO_MANIFEST).map(({ fileName }) => fileName),
      GAMEPLAY_MUSIC_MANIFEST.fileName,
    ];
    filenames.forEach((fileName) => expect(licenses).toContain(`\`${fileName}\``));
    expect(SFX_AUDIO_MANIFEST.revive.status).toBe("legacy-placeholder");
    expect(Object.values(expectedCueAssets)).not.toContain("revive");
    expect(Object.keys(SFX_AUDIO_MANIFEST).some((name) => /bolt/i.test(name))).toBe(false);
  });
});
