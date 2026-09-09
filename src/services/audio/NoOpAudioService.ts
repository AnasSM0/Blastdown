import type { FeedbackRequest } from "../feedback/types";
import type { AudioChannelSettings, AudioService } from "./types";

export type RecordingAudioService = AudioService & {
  readonly cues: FeedbackRequest[];
  readonly musicCalls: ("start" | "pause" | "resume" | "stop")[];
  readonly lifecycleCalls: ("preload" | "suspend" | "resume" | "stopAll" | "release")[];
  reset(): void;
};

/** Records calls instead of touching any native module. It retains the same
 * settings and identity gates as production so tests exercise the semantic
 * contract rather than a more permissive fake. */
export function createNoOpAudioService(): RecordingAudioService {
  const cues: FeedbackRequest[] = [];
  const musicCalls: ("start" | "pause" | "resume" | "stop")[] = [];
  const lifecycleCalls: ("preload" | "suspend" | "resume" | "stopAll" | "release")[] = [];
  const identities = new Set<string>();
  let settings: AudioChannelSettings = { soundEnabled: true, musicEnabled: true };
  let suspended = false;
  return {
    cues,
    musicCalls,
    lifecycleCalls,
    reset() {
      cues.length = 0;
      musicCalls.length = 0;
      lifecycleCalls.length = 0;
      identities.clear();
    },
    preload() {
      lifecycleCalls.push("preload");
    },
    configure(next) {
      settings = next;
    },
    play(request) {
      if (suspended || !settings.soundEnabled || identities.has(request.identity)) return;
      identities.add(request.identity);
      cues.push(request);
    },
    startMusic() {
      if (settings.musicEnabled && !suspended) musicCalls.push("start");
    },
    pauseMusic() {
      musicCalls.push("pause");
    },
    resumeMusic() {
      if (settings.musicEnabled && !suspended) musicCalls.push("resume");
    },
    stopMusic() {
      musicCalls.push("stop");
    },
    suspend() {
      if (suspended) return;
      suspended = true;
      lifecycleCalls.push("suspend");
    },
    resume() {
      if (!suspended) return;
      suspended = false;
      lifecycleCalls.push("resume");
    },
    stopAll() {
      lifecycleCalls.push("stopAll");
    },
    release() {
      lifecycleCalls.push("release");
    },
  };
}
