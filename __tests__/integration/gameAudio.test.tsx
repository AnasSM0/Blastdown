import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { captureAppStateHandlers } from "../../test-utils/appState";
import type { GameEvent } from "../../src/domain/events";
import type { GameState } from "../../src/domain/gameTypes";
import { useGameFeedback } from "../../src/hooks/useGameFeedback";
import { AudioServiceProvider } from "../../src/services/audio/AudioServiceProvider";
import {
  createNoOpAudioService,
  type RecordingAudioService,
} from "../../src/services/audio/NoOpAudioService";
import { createMemoryStorageService, StorageServiceProvider } from "../../src/services/storage";
import type { MemoryStorageService } from "../../src/services/storage";
import { defaultSettings } from "../../src/services/storage/schemas";
import { SettingsProvider, useSettings } from "../../src/state/SettingsProvider";

function wrapper(audio: RecordingAudioService, storage: MemoryStorageService) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StorageServiceProvider service={storage}>
        <SettingsProvider>
          <AudioServiceProvider service={audio}>{children}</AudioServiceProvider>
        </SettingsProvider>
      </StorageServiceProvider>
    );
  };
}

type Props = {
  sessionGeneration: number;
  turn: number;
  events: GameEvent[];
  status: GameState["status"];
  paused: boolean;
  combo: number;
  score: number;
  previousBest: number;
};

const BASE: Props = {
  sessionGeneration: 0,
  turn: 0,
  events: [],
  status: "playing",
  paused: false,
  combo: 0,
  score: 0,
  previousBest: 0,
};

const PLACEMENT: GameEvent[] = [
  { type: "piecePlaced", handId: "h", pieceId: "p1", cells: [{ row: 0, column: 0 }] },
];

function useHarness(props: Props) {
  const feedback = useGameFeedback(props);
  return { feedback, settings: useSettings() };
}

function seedSettings(
  storage: MemoryStorageService,
  patch: Partial<ReturnType<typeof defaultSettings>>,
) {
  storage.seed("blastdown/settings/v1", JSON.stringify({ ...defaultSettings(), ...patch }));
}

describe("committed game feedback", () => {
  it("plays an ordinary placement once and ignores a same-turn rerender", async () => {
    const audio = createNoOpAudioService();
    const storage = createMemoryStorageService();
    const { result, rerender } = await renderHook((props: Props) => useHarness(props), {
      wrapper: wrapper(audio, storage),
      initialProps: BASE,
    });
    await waitFor(() => expect(result.current.settings.loaded).toBe(true));

    await act(async () => rerender({ ...BASE, turn: 1, events: PLACEMENT }));
    await act(async () => rerender({ ...BASE, turn: 1, events: PLACEMENT }));

    expect(audio.cues).toEqual([
      { identity: "s0:t1", cue: "validPlacement", semitones: undefined },
    ]);
  });

  it("resolves placement plus clear to one magnitude cue with combo pitch", async () => {
    const audio = createNoOpAudioService();
    const storage = createMemoryStorageService();
    const { result, rerender } = await renderHook((props: Props) => useHarness(props), {
      wrapper: wrapper(audio, storage),
      initialProps: BASE,
    });
    await waitFor(() => expect(result.current.settings.loaded).toBe(true));

    await act(async () =>
      rerender({
        ...BASE,
        turn: 1,
        combo: 4,
        events: [...PLACEMENT, { type: "linesCleared", rows: [0, 1], columns: [] }],
      }),
    );

    expect(audio.cues).toEqual([{ identity: "s0:t1", cue: "clearDouble", semitones: 3 }]);
  });

  it("does not replay restored events on mount or after a fresh generation", async () => {
    const audio = createNoOpAudioService();
    const storage = createMemoryStorageService();
    const restored = { ...BASE, turn: 12, events: PLACEMENT };
    const { result, rerender } = await renderHook((props: Props) => useHarness(props), {
      wrapper: wrapper(audio, storage),
      initialProps: restored,
    });
    await waitFor(() => expect(result.current.settings.loaded).toBe(true));
    expect(audio.cues).toEqual([]);

    await act(async () => rerender({ ...restored, sessionGeneration: 1 }));
    expect(audio.cues).toEqual([]);
  });

  it("suppresses committed audio when sound is disabled", async () => {
    const audio = createNoOpAudioService();
    const storage = createMemoryStorageService();
    seedSettings(storage, { soundEnabled: false });
    const { result, rerender } = await renderHook((props: Props) => useHarness(props), {
      wrapper: wrapper(audio, storage),
      initialProps: BASE,
    });
    await waitFor(() => expect(result.current.settings.settings.soundEnabled).toBe(false));

    await act(async () => rerender({ ...BASE, turn: 1, events: PLACEMENT }));
    expect(audio.cues).toEqual([]);
  });

  it("emits new-best feedback from the committed game-over event and prior profile best", async () => {
    const audio = createNoOpAudioService();
    const storage = createMemoryStorageService();
    const { result, rerender } = await renderHook((props: Props) => useHarness(props), {
      wrapper: wrapper(audio, storage),
      initialProps: BASE,
    });
    await waitFor(() => expect(result.current.settings.loaded).toBe(true));

    await act(async () =>
      rerender({
        ...BASE,
        turn: 1,
        events: [{ type: "gameOver" }],
        status: "gameOver",
        score: 100,
        previousBest: 50,
      }),
    );

    expect(audio.cues).toEqual([{ identity: "s0:t1", cue: "newBest", semitones: undefined }]);
  });
});

describe("game feedback lifecycle", () => {
  it("starts music, pauses for Pause/Game Over, and stops all on unmount", async () => {
    const audio = createNoOpAudioService();
    const storage = createMemoryStorageService();
    const { result, rerender, unmount } = await renderHook((props: Props) => useHarness(props), {
      wrapper: wrapper(audio, storage),
      initialProps: BASE,
    });
    await waitFor(() => expect(result.current.settings.loaded).toBe(true));
    expect(audio.musicCalls).toContain("start");

    await act(async () => rerender({ ...BASE, paused: true }));
    await act(async () => rerender({ ...BASE, status: "gameOver" }));
    expect(audio.musicCalls.filter((call) => call === "pause").length).toBeGreaterThanOrEqual(1);

    await act(async () => unmount());
    expect(audio.lifecycleCalls).toContain("stopAll");
    expect(audio.lifecycleCalls).toContain("release");
  });

  it("suspends on background and restores without allocating a new service", async () => {
    const { handlers, restore } = captureAppStateHandlers();
    try {
      const audio = createNoOpAudioService();
      const storage = createMemoryStorageService();
      const { result } = await renderHook((props: Props) => useHarness(props), {
        wrapper: wrapper(audio, storage),
        initialProps: BASE,
      });
      await waitFor(() => expect(result.current.settings.loaded).toBe(true));
      audio.reset();

      await act(async () => handlers.forEach((handler) => handler("background")));
      await act(async () => handlers.forEach((handler) => handler("active")));

      expect(audio.lifecycleCalls).toEqual(["suspend", "resume"]);
    } finally {
      restore();
    }
  });
});
