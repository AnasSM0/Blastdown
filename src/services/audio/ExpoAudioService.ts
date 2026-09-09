import {
  clearPreloadedSource,
  createAudioPlayer,
  preload as preloadAudio,
  setAudioModeAsync,
  setIsAudioActiveAsync,
  type AudioPlayer,
} from "expo-audio";

import { GAMEPLAY_MUSIC_MANIFEST, SFX_AUDIO_MANIFEST } from "../../config/audioManifest";
import { feedbackSpec, playbackRateForSemitones } from "../feedback";
import { MUSIC_SOURCE, SFX_SOURCES } from "./sfxAssets";
import type { AudioChannelSettings, AudioService, SfxAssetName } from "./types";

const MUSIC_VOLUME = GAMEPLAY_MUSIC_MANIFEST.defaultVolume;
const EXPLOSION_DUCK_VOLUME = 0.065;
export const EXPLOSION_DUCK_MS = 520;
export const MAX_SFX_VOICES = 4;
const MAX_DEDUPE_IDENTITIES = 256;

type Voice = {
  player: AudioPlayer;
  priority: number;
  startedAt: number;
};

function safe(action: () => void): void {
  try {
    action();
  } catch {
    // Audio is non-essential; a player error must never break gameplay.
  }
}

function safeAsync(action: () => Promise<unknown>): void {
  try {
    void action().catch(() => {});
  } catch {
    // Some native adapters can throw before returning their promise.
  }
}

function isPlaying(player: AudioPlayer): boolean {
  try {
    return player.playing;
  } catch {
    return false;
  }
}

/** Expo Audio implementation with one bounded reusable player per asset that
 * is actually requested. The preload cache removes first-hit latency without
 * allocating an unbounded player set; at most four SFX can remain active. */
export function createExpoAudioService(): AudioService {
  const voices = new Map<SfxAssetName, Voice>();
  const playedIdentities = new Set<string>();
  const identityOrder: string[] = [];
  const lastPlayedAt = new Map<SfxAssetName, number>();
  const preloadedSources = [...Object.values(SFX_SOURCES), MUSIC_SOURCE];
  let settings: AudioChannelSettings = { soundEnabled: true, musicEnabled: true };
  let music: AudioPlayer | null = null;
  let musicPlaying = false;
  let suspended = false;
  let preloaded = false;
  let released = false;
  let startedAt = 0;
  let duckTimer: ReturnType<typeof setTimeout> | null = null;

  safeAsync(() => setAudioModeAsync({ playsInSilentMode: false }));

  function remember(identity: string): boolean {
    if (playedIdentities.has(identity)) return false;
    playedIdentities.add(identity);
    identityOrder.push(identity);
    if (identityOrder.length > MAX_DEDUPE_IDENTITIES) {
      const oldest = identityOrder.shift();
      if (oldest) playedIdentities.delete(oldest);
    }
    return true;
  }

  function playerFor(asset: SfxAssetName): Voice | null {
    const existing = voices.get(asset);
    if (existing) return existing;
    let player: AudioPlayer | null = null;
    safe(() => {
      player = createAudioPlayer(SFX_SOURCES[asset]);
    });
    if (!player) return null;
    const voice = { player, priority: 0, startedAt: 0 };
    voices.set(asset, voice);
    return voice;
  }

  function ensureMusic(): AudioPlayer | null {
    if (!music) {
      safe(() => {
        music = createAudioPlayer(MUSIC_SOURCE);
        music.loop = true;
        music.volume = MUSIC_VOLUME;
      });
    }
    return music;
  }

  function clearDuck(): void {
    if (duckTimer) {
      clearTimeout(duckTimer);
      duckTimer = null;
    }
    if (music) {
      safe(() => {
        if (music) music.volume = MUSIC_VOLUME;
      });
    }
  }

  function stopSfx(): void {
    for (const voice of voices.values()) {
      safe(() => {
        voice.player.pause();
        void voice.player.seekTo(0).catch(() => {});
      });
    }
  }

  const service: AudioService = {
    preload() {
      if (preloaded || released) return;
      preloaded = true;
      for (const source of preloadedSources) safeAsync(() => preloadAudio(source));
    },
    configure(next) {
      settings = next;
      if (!next.soundEnabled) stopSfx();
      if (!next.musicEnabled) service.stopMusic();
    },
    play(request) {
      if (!remember(request.identity) || released || suspended || !settings.soundEnabled) return;
      const spec = feedbackSpec(request.cue);
      const definition = SFX_AUDIO_MANIFEST[spec.asset];
      const now = Date.now();
      const previousPlay = lastPlayedAt.get(spec.asset);
      if (previousPlay !== undefined && now - previousPlay < definition.minimumRetriggerMs) return;

      if (spec.ducks) {
        for (const voice of voices.values()) {
          if (isPlaying(voice.player) && voice.priority < spec.priority) {
            safe(() => voice.player.pause());
          }
        }
      }

      const existing = voices.get(spec.asset);
      const active = [...voices.values()].filter((voice) => isPlaying(voice.player));
      if ((!existing || !isPlaying(existing.player)) && active.length >= MAX_SFX_VOICES) {
        const victim = [...active].sort(
          (a, b) => a.priority - b.priority || a.startedAt - b.startedAt,
        )[0];
        if (victim.priority > spec.priority) return;
        safe(() => victim.player.pause());
      }

      const voice = playerFor(spec.asset);
      if (!voice) return;
      lastPlayedAt.set(spec.asset, now);
      voice.priority = spec.priority;
      voice.startedAt = ++startedAt;
      safe(() => {
        voice.player.shouldCorrectPitch = false;
        voice.player.setPlaybackRate(
          playbackRateForSemitones(definition.pitchVariationAllowed ? (request.semitones ?? 0) : 0),
        );
        voice.player.volume = spec.volume;
        void voice.player.seekTo(0).catch(() => {});
        voice.player.play();
      });

      if (spec.ducks && music) {
        clearDuck();
        safe(() => {
          if (music) music.volume = EXPLOSION_DUCK_VOLUME;
        });
        duckTimer = setTimeout(() => {
          duckTimer = null;
          if (!suspended && music) {
            safe(() => {
              if (music) music.volume = MUSIC_VOLUME;
            });
          }
        }, EXPLOSION_DUCK_MS);
      }
    },
    startMusic() {
      if (released || suspended || musicPlaying || !settings.musicEnabled) return;
      const player = ensureMusic();
      if (!player) return;
      musicPlaying = true;
      safe(() => player.play());
    },
    pauseMusic() {
      if (!music || !musicPlaying) return;
      musicPlaying = false;
      safe(() => music?.pause());
    },
    resumeMusic() {
      if (released || suspended || !music || musicPlaying || !settings.musicEnabled) return;
      musicPlaying = true;
      safe(() => music?.play());
    },
    stopMusic() {
      clearDuck();
      if (!music) return;
      musicPlaying = false;
      safe(() => {
        music?.pause();
        void music?.seekTo(0).catch(() => {});
      });
    },
    suspend() {
      if (released || suspended) return;
      suspended = true;
      clearDuck();
      stopSfx();
      service.pauseMusic();
      safeAsync(() => setIsAudioActiveAsync(false));
    },
    resume() {
      if (released || !suspended) return;
      suspended = false;
      safeAsync(() => setIsAudioActiveAsync(true));
    },
    stopAll() {
      stopSfx();
      service.stopMusic();
    },
    release() {
      if (released) return;
      released = true;
      service.stopAll();
      for (const voice of voices.values()) safe(() => voice.player.remove());
      voices.clear();
      if (music) safe(() => music?.remove());
      music = null;
      for (const source of preloaded ? preloadedSources : []) {
        safeAsync(() => clearPreloadedSource(source));
      }
      playedIdentities.clear();
      identityOrder.length = 0;
      lastPlayedAt.clear();
    },
  };

  return service;
}
