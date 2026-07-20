import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

import { MUSIC_SOURCE, SFX_SOURCES } from "./sfxAssets";
import type { AudioService, SfxName } from "./types";

const MUSIC_VOLUME = 0.5;

function safe(action: () => void): void {
  try {
    action();
  } catch {
    // Audio is non-essential; a player error must never break gameplay.
  }
}

/** expo-audio implementation. Players are created lazily and reused, so a
 *  repeated effect just seeks to 0 and plays (no per-trigger allocation). The
 *  music loop is a single looping player toggled between play/pause/stop.
 *  Every native call is wrapped so failures degrade to silence. */
export function createExpoAudioService(): AudioService {
  const sfxPlayers = new Map<SfxName, AudioPlayer>();
  let music: AudioPlayer | null = null;
  let musicPlaying = false;

  // Allow effects to play alongside other apps' audio, and keep playing while
  // the device is on silent is intentionally NOT set — we respect the ringer.
  safe(() => void setAudioModeAsync({ playsInSilentMode: false }));

  function sfxPlayer(name: SfxName): AudioPlayer | null {
    let player = sfxPlayers.get(name);
    if (!player) {
      let created: AudioPlayer | null = null;
      safe(() => {
        created = createAudioPlayer(SFX_SOURCES[name]);
      });
      if (!created) {
        return null;
      }
      player = created;
      sfxPlayers.set(name, player);
    }
    return player;
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

  return {
    playSfx(name) {
      const player = sfxPlayer(name);
      if (!player) {
        return;
      }
      safe(() => {
        void player.seekTo(0);
        player.play();
      });
    },
    startMusic() {
      if (musicPlaying) {
        return;
      }
      const player = ensureMusic();
      if (!player) {
        return;
      }
      musicPlaying = true;
      safe(() => player.play());
    },
    pauseMusic() {
      if (!music || !musicPlaying) {
        return;
      }
      musicPlaying = false;
      safe(() => music?.pause());
    },
    resumeMusic() {
      if (!music || musicPlaying) {
        return;
      }
      musicPlaying = true;
      safe(() => music?.play());
    },
    stopMusic() {
      if (!music) {
        return;
      }
      musicPlaying = false;
      safe(() => {
        music?.pause();
        void music?.seekTo(0);
      });
    },
    release() {
      safe(() => {
        for (const player of sfxPlayers.values()) {
          player.remove();
        }
        sfxPlayers.clear();
        music?.remove();
        music = null;
        musicPlaying = false;
      });
    },
  };
}
