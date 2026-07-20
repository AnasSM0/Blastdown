import type { AudioService, SfxName } from "./types";

export type RecordingAudioService = AudioService & {
  /** Effects played, in order — for test assertions. */
  readonly sfx: SfxName[];
  /** Music lifecycle calls, in order. */
  readonly musicCalls: ("start" | "pause" | "resume" | "stop")[];
  reset(): void;
};

/** Records calls instead of touching any native module. Backs tests and any
 *  environment without an audio engine — a fully safe no-op. */
export function createNoOpAudioService(): RecordingAudioService {
  const sfx: SfxName[] = [];
  const musicCalls: ("start" | "pause" | "resume" | "stop")[] = [];
  return {
    sfx,
    musicCalls,
    reset() {
      sfx.length = 0;
      musicCalls.length = 0;
    },
    playSfx(name) {
      sfx.push(name);
    },
    startMusic() {
      musicCalls.push("start");
    },
    pauseMusic() {
      musicCalls.push("pause");
    },
    resumeMusic() {
      musicCalls.push("resume");
    },
    stopMusic() {
      musicCalls.push("stop");
    },
    release() {},
  };
}
