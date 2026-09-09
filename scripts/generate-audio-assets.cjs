/* global __dirname, Buffer */
const fs = require("node:fs");
const path = require("node:path");

const AUDIO_DIR = path.resolve(__dirname, "../assets/audio");
const SFX_RATE = 44_100;
const MUSIC_RATE = 32_000;
let randomState = 0xb1a57d0f;

function random() {
  randomState = (Math.imul(randomState, 1_664_525) + 1_013_904_223) >>> 0;
  return randomState / 0x1_0000_0000;
}

function track(duration, sampleRate, channels = 1, circular = false) {
  const frames = Math.round(duration * sampleRate);
  return { sampleRate, channels, frames, circular, samples: new Float64Array(frames * channels) };
}

function envelope(time, duration, attack, release) {
  const rise = attack <= 0 ? 1 : Math.min(1, time / attack);
  const fall = release <= 0 ? 1 : Math.min(1, (duration - time) / release);
  return Math.pow(Math.max(0, Math.min(rise, fall)), 1.45);
}

function writeFrame(output, frame, value, pan = 0) {
  let target = frame;
  if (output.circular) {
    target = ((target % output.frames) + output.frames) % output.frames;
  } else if (target < 0 || target >= output.frames) {
    return;
  }
  if (output.channels === 1) {
    output.samples[target] += value;
    return;
  }
  const clampedPan = Math.max(-1, Math.min(1, pan));
  const left = Math.sqrt((1 - clampedPan) / 2);
  const right = Math.sqrt((1 + clampedPan) / 2);
  output.samples[target * 2] += value * left;
  output.samples[target * 2 + 1] += value * right;
}

function tone(output, options) {
  const {
    start = 0,
    duration,
    frequency,
    endFrequency = frequency,
    amplitude,
    attack = 0.003,
    release = duration * 0.5,
    pan = 0,
    harmonics = [1],
  } = options;
  const count = Math.round(duration * output.sampleRate);
  const startFrame = Math.round(start * output.sampleRate);
  for (let index = 0; index < count; index += 1) {
    const time = index / output.sampleRate;
    const sweep = (endFrequency - frequency) / duration;
    const phase = 2 * Math.PI * (frequency * time + 0.5 * sweep * time * time);
    const wave = harmonics.reduce(
      (sum, harmonic, harmonicIndex) =>
        sum + Math.sin(phase * harmonic) / Math.pow(harmonic, 1.25 + harmonicIndex * 0.08),
      0,
    );
    writeFrame(
      output,
      startFrame + index,
      amplitude * envelope(time, duration, attack, release) * wave,
      pan,
    );
  }
}

function noise(output, options) {
  const {
    start = 0,
    duration,
    amplitude,
    attack = 0.001,
    release = duration * 0.8,
    pan = 0,
    filter = "high",
    smoothing = 0.16,
  } = options;
  const count = Math.round(duration * output.sampleRate);
  const startFrame = Math.round(start * output.sampleRate);
  let low = 0;
  for (let index = 0; index < count; index += 1) {
    const time = index / output.sampleRate;
    const white = random() * 2 - 1;
    low += smoothing * (white - low);
    const filtered = filter === "low" ? low : white - low;
    writeFrame(
      output,
      startFrame + index,
      filtered * amplitude * envelope(time, duration, attack, release),
      pan,
    );
  }
}

function midi(note) {
  return 440 * 2 ** ((note - 69) / 12);
}

function smoothLoopSeam(output) {
  const width = Math.round(output.sampleRate * 0.006);
  for (let channel = 0; channel < output.channels; channel += 1) {
    const firstIndex = channel;
    const lastIndex = (output.frames - 1) * output.channels + channel;
    const seam = (output.samples[firstIndex] + output.samples[lastIndex]) / 2;
    const startSlope = output.samples[output.channels + channel] - output.samples[firstIndex];
    const endSlope = output.samples[lastIndex] - output.samples[lastIndex - output.channels];
    const slope = (startSlope + endSlope) / 2;
    for (let index = 0; index < width; index += 1) {
      const weight = (1 - index / width) ** 2;
      const start = index * output.channels + channel;
      const end = (output.frames - 1 - index) * output.channels + channel;
      output.samples[start] =
        output.samples[start] * (1 - weight) + (seam + slope * index) * weight;
      output.samples[end] = output.samples[end] * (1 - weight) + (seam - slope * index) * weight;
    }
  }
}

function normalize(output, targetDb) {
  for (let channel = 0; channel < output.channels; channel += 1) {
    let mean = 0;
    for (let frame = 0; frame < output.frames; frame += 1) {
      mean += output.samples[frame * output.channels + channel];
    }
    mean /= output.frames;
    for (let frame = 0; frame < output.frames; frame += 1) {
      const index = frame * output.channels + channel;
      output.samples[index] = Math.tanh((output.samples[index] - mean) * 1.08);
    }
  }
  let peak = 0;
  for (const sample of output.samples) peak = Math.max(peak, Math.abs(sample));
  const scale = 10 ** (targetDb / 20) / Math.max(peak, 1e-9);
  for (let index = 0; index < output.samples.length; index += 1) {
    output.samples[index] *= scale;
  }
}

function trim(output, minimumDuration = 0.045) {
  const threshold = 0.001;
  let firstAudible = output.frames;
  let lastAudible = 0;
  for (let frame = 0; frame < output.frames; frame += 1) {
    for (let channel = 0; channel < output.channels; channel += 1) {
      if (Math.abs(output.samples[frame * output.channels + channel]) >= threshold) {
        firstAudible = Math.min(firstAudible, frame);
        lastAudible = Math.max(lastAudible, frame);
      }
    }
  }
  if (firstAudible > lastAudible) return output;

  const leadingPadding = Math.round(output.sampleRate * 0.0015);
  const trailingPadding = Math.round(output.sampleRate * 0.006);
  const start = Math.max(0, firstAudible - leadingPadding);
  const minimumFrames = Math.round(output.sampleRate * minimumDuration);
  const end = Math.min(
    output.frames,
    Math.max(lastAudible + trailingPadding + 1, start + minimumFrames),
  );
  const result = track((end - start) / output.sampleRate, output.sampleRate, output.channels);
  result.samples.set(output.samples.subarray(start * output.channels, end * output.channels));
  return result;
}

function wavBytes(output) {
  const dataSize = output.samples.length * 2;
  const bytes = Buffer.alloc(44 + dataSize);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(36 + dataSize, 4);
  bytes.write("WAVE", 8);
  bytes.write("fmt ", 12);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(output.channels, 22);
  bytes.writeUInt32LE(output.sampleRate, 24);
  bytes.writeUInt32LE(output.sampleRate * output.channels * 2, 28);
  bytes.writeUInt16LE(output.channels * 2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(dataSize, 40);
  output.samples.forEach((sample, index) => {
    bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + index * 2);
  });
  return bytes;
}

function save(name, duration, build, targetDb = -2.2) {
  const output = track(duration, SFX_RATE);
  build(output);
  normalize(output, targetDb);
  fs.writeFileSync(path.join(AUDIO_DIR, name), wavBytes(trim(output)));
}

function clearSound(output, magnitude) {
  const richness = Math.min(4, magnitude);
  tone(output, {
    duration: 0.3 + richness * 0.045,
    frequency: 520,
    endFrequency: 780,
    amplitude: 0.34,
    release: 0.2,
    harmonics: [1, 2],
  });
  tone(output, {
    start: 0.018,
    duration: 0.25 + richness * 0.04,
    frequency: 780,
    endFrequency: 1170,
    amplitude: 0.2,
    release: 0.22,
    harmonics: [1, 2, 3],
  });
  for (let layer = 1; layer < richness; layer += 1) {
    tone(output, {
      start: 0.055 * layer,
      duration: 0.22 + layer * 0.025,
      frequency: 1040 + layer * 170,
      endFrequency: 1320 + layer * 210,
      amplitude: 0.12 / Math.sqrt(layer),
      release: 0.18,
    });
  }
  noise(output, {
    duration: 0.085 + richness * 0.012,
    amplitude: 0.055,
    release: 0.08,
    smoothing: 0.08,
  });
}

save(
  "button.wav",
  0.055,
  (out) => {
    tone(out, {
      duration: 0.05,
      frequency: 1450,
      endFrequency: 1050,
      amplitude: 0.36,
      release: 0.04,
    });
    noise(out, { duration: 0.018, amplitude: 0.055, release: 0.016 });
  },
  -3.5,
);
save(
  "selection.wav",
  0.075,
  (out) => {
    tone(out, {
      duration: 0.07,
      frequency: 760,
      endFrequency: 1420,
      amplitude: 0.34,
      release: 0.052,
      harmonics: [1, 2],
    });
  },
  -3.2,
);
save(
  "placement.wav",
  0.13,
  (out) => {
    noise(out, { duration: 0.025, amplitude: 0.22, release: 0.02, smoothing: 0.11 });
    tone(out, {
      duration: 0.125,
      frequency: 190,
      endFrequency: 118,
      amplitude: 0.44,
      release: 0.1,
      harmonics: [1, 2],
    });
    tone(out, {
      start: 0.008,
      duration: 0.095,
      frequency: 640,
      endFrequency: 520,
      amplitude: 0.18,
      release: 0.075,
    });
  },
  -2.4,
);
save(
  "invalid.wav",
  0.18,
  (out) => {
    tone(out, {
      duration: 0.078,
      frequency: 560,
      endFrequency: 390,
      amplitude: 0.36,
      release: 0.055,
      harmonics: [1, 2],
    });
    tone(out, {
      start: 0.075,
      duration: 0.1,
      frequency: 405,
      endFrequency: 255,
      amplitude: 0.4,
      release: 0.07,
      harmonics: [1, 2],
    });
  },
  -2.5,
);
save("lineClear.wav", 0.35, (out) => clearSound(out, 1), -2.2);
save("clearDouble.wav", 0.43, (out) => clearSound(out, 2), -2);
save("clearTriple.wav", 0.5, (out) => clearSound(out, 3), -1.8);
save("clearOverload.wav", 0.58, (out) => clearSound(out, 4), -1.5);
save(
  "timer2.wav",
  0.17,
  (out) => {
    tone(out, {
      duration: 0.15,
      frequency: 690,
      endFrequency: 820,
      amplitude: 0.34,
      release: 0.1,
      harmonics: [1, 2],
    });
    tone(out, { start: 0.018, duration: 0.12, frequency: 1380, amplitude: 0.1, release: 0.095 });
  },
  -3,
);
save(
  "timer1.wav",
  0.23,
  (out) => {
    tone(out, {
      duration: 0.09,
      frequency: 760,
      endFrequency: 610,
      amplitude: 0.4,
      release: 0.06,
      harmonics: [1, 2],
    });
    tone(out, {
      start: 0.105,
      duration: 0.12,
      frequency: 920,
      endFrequency: 690,
      amplitude: 0.45,
      release: 0.08,
      harmonics: [1, 2],
    });
    noise(out, { start: 0.105, duration: 0.035, amplitude: 0.055, release: 0.03 });
  },
  -2.2,
);
save(
  "defuse.wav",
  0.4,
  (out) => {
    tone(out, {
      duration: 0.36,
      frequency: 430,
      endFrequency: 880,
      amplitude: 0.3,
      release: 0.22,
      harmonics: [1, 2],
    });
    tone(out, {
      start: 0.1,
      duration: 0.29,
      frequency: 660,
      endFrequency: 1320,
      amplitude: 0.17,
      release: 0.2,
    });
    noise(out, { duration: 0.11, amplitude: 0.055, release: 0.1, filter: "low", smoothing: 0.05 });
  },
  -2,
);
save(
  "clutch.wav",
  0.5,
  (out) => {
    tone(out, {
      duration: 0.46,
      frequency: 390,
      endFrequency: 1040,
      amplitude: 0.38,
      release: 0.26,
      harmonics: [1, 2],
    });
    tone(out, {
      start: 0.075,
      duration: 0.4,
      frequency: 780,
      endFrequency: 1560,
      amplitude: 0.2,
      release: 0.27,
      harmonics: [1, 2],
    });
    tone(out, {
      start: 0.16,
      duration: 0.3,
      frequency: 1310,
      endFrequency: 1760,
      amplitude: 0.12,
      release: 0.23,
    });
  },
  -1.6,
);
save(
  "defusePowerUp.wav",
  0.44,
  (out) => {
    tone(out, {
      duration: 0.4,
      frequency: 360,
      endFrequency: 980,
      amplitude: 0.34,
      release: 0.24,
      harmonics: [1, 2, 3],
    });
    tone(out, {
      start: 0.07,
      duration: 0.34,
      frequency: 990,
      endFrequency: 1480,
      amplitude: 0.16,
      release: 0.25,
    });
    noise(out, { duration: 0.16, amplitude: 0.045, release: 0.14, filter: "low", smoothing: 0.04 });
  },
  -1.9,
);
save(
  "freeze.wav",
  0.42,
  (out) => {
    tone(out, {
      duration: 0.38,
      frequency: 1680,
      endFrequency: 710,
      amplitude: 0.27,
      release: 0.25,
      harmonics: [1, 2],
    });
    tone(out, {
      start: 0.055,
      duration: 0.34,
      frequency: 2250,
      endFrequency: 1260,
      amplitude: 0.12,
      release: 0.24,
    });
    noise(out, { duration: 0.24, amplitude: 0.075, release: 0.2, smoothing: 0.04 });
  },
  -2,
);
save(
  "explosion.wav",
  0.58,
  (out) => {
    noise(out, { duration: 0.085, amplitude: 0.75, release: 0.075, smoothing: 0.12 });
    tone(out, {
      duration: 0.42,
      frequency: 92,
      endFrequency: 43,
      amplitude: 0.9,
      release: 0.34,
      harmonics: [1, 2, 3],
    });
    tone(out, {
      start: 0.012,
      duration: 0.34,
      frequency: 285,
      endFrequency: 82,
      amplitude: 0.42,
      release: 0.28,
      harmonics: [1, 2],
    });
    noise(out, {
      start: 0.035,
      duration: 0.52,
      amplitude: 0.22,
      release: 0.44,
      filter: "low",
      smoothing: 0.025,
    });
  },
  -1.2,
);
save(
  "rubbleClear.wav",
  0.22,
  (out) => {
    [0, 0.025, 0.054, 0.086].forEach((start, index) => {
      noise(out, {
        start,
        duration: 0.04,
        amplitude: 0.18 / (1 + index * 0.12),
        release: 0.035,
        smoothing: 0.09,
      });
      tone(out, {
        start,
        duration: 0.12,
        frequency: 540 + index * 170,
        endFrequency: 760 + index * 190,
        amplitude: 0.09,
        release: 0.1,
      });
    });
  },
  -2.3,
);
save(
  "gameOver.wav",
  0.78,
  (out) => {
    [57, 53, 48].forEach((note, index) => {
      tone(out, {
        start: index * 0.15,
        duration: 0.52 - index * 0.03,
        frequency: midi(note),
        endFrequency: midi(note - 2),
        amplitude: 0.28,
        release: 0.34,
        harmonics: [1, 2],
      });
    });
    tone(out, {
      start: 0.36,
      duration: 0.4,
      frequency: 92,
      endFrequency: 58,
      amplitude: 0.24,
      release: 0.32,
    });
  },
  -2.2,
);
save(
  "newBest.wav",
  0.74,
  (out) => {
    [69, 72, 76, 81].forEach((note, index) => {
      tone(out, {
        start: index * 0.09,
        duration: 0.39,
        frequency: midi(note),
        endFrequency: midi(note + 1),
        amplitude: 0.21,
        release: 0.3,
        harmonics: [1, 2],
      });
    });
    tone(out, {
      start: 0.3,
      duration: 0.42,
      frequency: midi(57),
      amplitude: 0.16,
      release: 0.34,
      harmonics: [1, 2, 3],
    });
  },
  -1.8,
);

function buildMusic() {
  const beat = 60 / 100;
  const bar = beat * 4;
  const duration = bar * 8;
  const output = track(duration, MUSIC_RATE, 2, true);
  const chords = [
    [57, 60, 64, 71],
    [53, 57, 60, 64],
    [55, 59, 62, 67],
    [52, 55, 59, 64],
    [57, 60, 64, 69],
    [53, 57, 60, 65],
    [55, 59, 62, 69],
    [52, 56, 59, 64],
  ];
  const roots = [45, 41, 43, 40, 45, 41, 43, 40];
  chords.forEach((chord, barIndex) => {
    const start = barIndex * bar;
    chord.forEach((note, noteIndex) => {
      tone(output, {
        start: start - 0.08,
        duration: bar + 0.5,
        frequency: midi(note),
        amplitude: 0.038,
        attack: 0.32,
        release: 0.75,
        pan: (noteIndex - 1.5) * 0.26,
        harmonics: [1, 2],
      });
    });
    for (let step = 0; step < 8; step += 1) {
      const note = chord[(step + barIndex) % chord.length] + 12;
      tone(output, {
        start: start + step * (beat / 2),
        duration: 0.24,
        frequency: midi(note),
        amplitude: step % 2 === 0 ? 0.027 : 0.019,
        attack: 0.012,
        release: 0.19,
        pan: step % 2 === 0 ? -0.32 : 0.32,
        harmonics: [1, 2],
      });
    }
    for (let pulse = 0; pulse < 4; pulse += 1) {
      tone(output, {
        start: start + pulse * beat,
        duration: 0.32,
        frequency: midi(roots[barIndex]),
        endFrequency: midi(roots[barIndex] - 1),
        amplitude: pulse === 0 ? 0.085 : 0.06,
        attack: 0.008,
        release: 0.27,
        harmonics: [1, 2],
      });
      tone(output, {
        start: start + pulse * beat,
        duration: 0.13,
        frequency: 58,
        endFrequency: 40,
        amplitude: pulse === 0 ? 0.075 : 0.04,
        attack: 0.002,
        release: 0.11,
      });
      noise(output, {
        start: start + pulse * beat + beat / 2,
        duration: 0.04,
        amplitude: 0.012,
        release: 0.035,
        pan: pulse % 2 === 0 ? -0.2 : 0.2,
        smoothing: 0.08,
      });
    }
  });
  smoothLoopSeam(output);
  normalize(output, -8);
  fs.writeFileSync(path.join(AUDIO_DIR, "music-loop.wav"), wavBytes(output));
}

buildMusic();

for (const name of fs
  .readdirSync(AUDIO_DIR)
  .filter((file) => file.endsWith(".wav"))
  .sort()) {
  const bytes = fs.statSync(path.join(AUDIO_DIR, name)).size;
  process.stdout.write(`${name.padEnd(22)} ${(bytes / 1024).toFixed(1).padStart(7)} KiB\n`);
}
