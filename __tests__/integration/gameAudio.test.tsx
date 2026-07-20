import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AppState } from "react-native";
import type { ReactNode } from "react";

import type { GameEvent } from "../../src/domain/events";
import { useGameAudio } from "../../src/hooks/useGameAudio";
import { createNoOpAudioService } from "../../src/services/audio/NoOpAudioService";
import type { RecordingAudioService } from "../../src/services/audio/NoOpAudioService";
import { AudioServiceProvider } from "../../src/services/audio/AudioServiceProvider";
import { StorageServiceProvider, createMemoryStorageService } from "../../src/services/storage";
import type { MemoryStorageService } from "../../src/services/storage";
import { SettingsProvider, useSettings } from "../../src/state/SettingsProvider";
import { defaultSettings } from "../../src/services/storage/schemas";

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

type Props = { turn: number; events: GameEvent[]; status: string };

function useHarness(props: Props) {
  useGameAudio(props);
  return useSettings();
}

const CLEAR_TURN: GameEvent[] = [
  { type: "piecePlaced", handId: "h", pieceId: "p1", cells: [{ row: 0, column: 0 }] },
  { type: "linesCleared", rows: [0], columns: [] },
  { type: "scoreChanged", delta: 100, score: 100 },
];

function seedSettings(
  storage: MemoryStorageService,
  patch: Partial<ReturnType<typeof defaultSettings>>,
) {
  storage.seed("blastdown/settings/v1", JSON.stringify({ ...defaultSettings(), ...patch }));
}

describe("useGameAudio sound effects", () => {
  it("plays a turn's event sounds once, and never on a re-render with no new turn", async () => {
    const audio = createNoOpAudioService();
    const storage = createMemoryStorageService();
    const { result, rerender } = await renderHook((p: Props) => useHarness(p), {
      wrapper: wrapper(audio, storage),
      initialProps: { turn: 0, events: [] as GameEvent[], status: "playing" },
    });
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await act(async () => {
      rerender({ turn: 1, events: CLEAR_TURN, status: "playing" });
    });
    expect(audio.sfx).toEqual(["placement", "lineClear"]);

    // Same turn, re-render: no additional sounds (no spam).
    await act(async () => {
      rerender({ turn: 1, events: CLEAR_TURN, status: "playing" });
    });
    expect(audio.sfx).toEqual(["placement", "lineClear"]);
  });

  it("produces no sound effects when sound is disabled", async () => {
    const audio = createNoOpAudioService();
    const storage = createMemoryStorageService();
    seedSettings(storage, { soundEnabled: false });
    const { result, rerender } = await renderHook((p: Props) => useHarness(p), {
      wrapper: wrapper(audio, storage),
      initialProps: { turn: 0, events: [] as GameEvent[], status: "playing" },
    });
    await waitFor(() => expect(result.current.settings.soundEnabled).toBe(false));

    await act(async () => {
      rerender({ turn: 1, events: CLEAR_TURN, status: "playing" });
    });
    expect(audio.sfx).toEqual([]);
  });
});

describe("useGameAudio music lifecycle", () => {
  it("starts music on mount, pauses on game over, and stops on unmount", async () => {
    const audio = createNoOpAudioService();
    const storage = createMemoryStorageService();
    const { result, rerender, unmount } = await renderHook((p: Props) => useHarness(p), {
      wrapper: wrapper(audio, storage),
      initialProps: { turn: 0, events: [] as GameEvent[], status: "playing" },
    });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(audio.musicCalls).toContain("start");

    await act(async () => {
      rerender({ turn: 0, events: [], status: "gameOver" });
    });
    expect(audio.musicCalls).toContain("pause");

    await act(async () => {
      unmount();
    });
    expect(audio.musicCalls).toContain("stop");
  });

  it("does not start music when music is disabled", async () => {
    const audio = createNoOpAudioService();
    const storage = createMemoryStorageService();
    seedSettings(storage, { musicEnabled: false });
    const { result } = await renderHook((p: Props) => useHarness(p), {
      wrapper: wrapper(audio, storage),
      initialProps: { turn: 0, events: [] as GameEvent[], status: "playing" },
    });
    await waitFor(() => expect(result.current.settings.musicEnabled).toBe(false));
    expect(audio.musicCalls).not.toContain("start");
  });

  it("pauses music when the app backgrounds", async () => {
    const handlers: ((s: string) => void)[] = [];
    const spy = jest.spyOn(AppState, "addEventListener").mockImplementation((_e, h) => {
      handlers.push(h as (s: string) => void);
      return { remove: jest.fn() } as never;
    });
    try {
      const audio = createNoOpAudioService();
      const storage = createMemoryStorageService();
      const { result } = await renderHook((p: Props) => useHarness(p), {
        wrapper: wrapper(audio, storage),
        initialProps: { turn: 0, events: [] as GameEvent[], status: "playing" },
      });
      await waitFor(() => expect(result.current.loaded).toBe(true));
      audio.reset();

      await act(async () => {
        handlers.forEach((h) => h("background"));
      });
      expect(audio.musicCalls).toContain("pause");
    } finally {
      spy.mockRestore();
    }
  });
});
