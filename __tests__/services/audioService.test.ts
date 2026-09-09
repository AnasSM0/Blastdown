const players: FakePlayer[] = [];
const mockPreload = jest.fn(() => Promise.resolve());
const mockClearPreloadedSource = jest.fn(() => Promise.resolve());
const mockSetIsAudioActiveAsync = jest.fn(() => Promise.resolve());

type FakePlayer = {
  playing: boolean;
  loop: boolean;
  volume: number;
  shouldCorrectPitch: boolean;
  play: jest.Mock;
  pause: jest.Mock;
  seekTo: jest.Mock;
  setPlaybackRate: jest.Mock;
  remove: jest.Mock;
};

function fakePlayer(): FakePlayer {
  const player: FakePlayer = {
    playing: false,
    loop: false,
    volume: 1,
    shouldCorrectPitch: true,
    play: jest.fn(() => {
      player.playing = true;
    }),
    pause: jest.fn(() => {
      player.playing = false;
    }),
    seekTo: jest.fn(() => Promise.resolve()),
    setPlaybackRate: jest.fn(),
    remove: jest.fn(),
  };
  players.push(player);
  return player;
}

const mockCreateAudioPlayer = jest.fn(() => fakePlayer());

jest.mock("expo-audio", () => ({
  createAudioPlayer: mockCreateAudioPlayer,
  preload: mockPreload,
  clearPreloadedSource: mockClearPreloadedSource,
  setIsAudioActiveAsync: mockSetIsAudioActiveAsync,
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { EXPLOSION_DUCK_MS, MAX_SFX_VOICES, createExpoAudioService } =
  require("../../src/services/audio/ExpoAudioService") as typeof import("../../src/services/audio/ExpoAudioService");
/* eslint-enable @typescript-eslint/no-require-imports */

describe("ExpoAudioService", () => {
  beforeEach(() => {
    players.length = 0;
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("preloads the manifest once and releases every owned resource", async () => {
    const service = createExpoAudioService();
    service.preload();
    service.preload();
    await Promise.resolve();

    expect(mockPreload).toHaveBeenCalledTimes(12);
    service.play({ identity: "pickup-1", cue: "piecePickup" });
    service.startMusic();
    service.release();
    await Promise.resolve();

    expect(players.every((player) => player.remove.mock.calls.length === 1)).toBe(true);
    expect(mockClearPreloadedSource).toHaveBeenCalledTimes(12);
  });

  it("deduplicates event identities and applies the combo semitone rate", () => {
    const service = createExpoAudioService();
    service.play({ identity: "s1:t1", cue: "clearSingle", semitones: 4 });
    service.play({ identity: "s1:t1", cue: "clearSingle", semitones: 4 });

    expect(mockCreateAudioPlayer).toHaveBeenCalledTimes(1);
    expect(players[0].play).toHaveBeenCalledTimes(1);
    expect(players[0].shouldCorrectPitch).toBe(false);
    expect(players[0].setPlaybackRate).toHaveBeenCalledWith(2 ** (4 / 12));
  });

  it("keeps simultaneous voices bounded and lets higher priority evict lower priority", () => {
    const service = createExpoAudioService();
    const cues = ["uiTap", "piecePickup", "validPlacement", "invalidPlacement"] as const;
    cues.forEach((cue, index) => service.play({ identity: `i${index}`, cue }));
    expect(players.filter((player) => player.playing)).toHaveLength(MAX_SFX_VOICES);

    service.play({ identity: "clear", cue: "clearSingle" });

    expect(players.filter((player) => player.playing)).toHaveLength(MAX_SFX_VOICES);
    expect(players[0].pause).toHaveBeenCalledTimes(1);
  });

  it("suppresses sound immediately when disabled", () => {
    const service = createExpoAudioService();
    service.configure({ soundEnabled: false, musicEnabled: false });
    service.play({ identity: "off", cue: "explosion" });
    service.startMusic();

    expect(mockCreateAudioPlayer).not.toHaveBeenCalled();
  });

  it("makes explosion dominant, ducks music briefly, and restores safely", () => {
    const service = createExpoAudioService();
    service.startMusic();
    const music = players[0];
    service.play({ identity: "placement", cue: "validPlacement" });
    const placement = players[1];

    service.play({ identity: "explosion", cue: "explosion" });

    expect(placement.pause).toHaveBeenCalled();
    expect(music.volume).toBeLessThan(0.5);
    jest.advanceTimersByTime(EXPLOSION_DUCK_MS);
    expect(music.volume).toBe(0.5);
  });

  it("suspends players on interruption and resumes without duplicating them", async () => {
    const service = createExpoAudioService();
    service.startMusic();
    service.play({ identity: "p1", cue: "validPlacement" });
    const allocated = players.length;

    service.suspend();
    service.resume();
    await Promise.resolve();

    expect(mockSetIsAudioActiveAsync).toHaveBeenNthCalledWith(1, false);
    expect(mockSetIsAudioActiveAsync).toHaveBeenNthCalledWith(2, true);
    expect(players).toHaveLength(allocated);
  });

  it("contains native provider failures", () => {
    mockCreateAudioPlayer.mockImplementationOnce(() => {
      throw new Error("native audio unavailable");
    });
    const service = createExpoAudioService();

    expect(() => service.play({ identity: "safe", cue: "validPlacement" })).not.toThrow();
  });
});
