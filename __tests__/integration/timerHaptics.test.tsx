import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import type { GameEvent } from "../../src/domain/events";

const mockImpactAsync = jest.fn(() => Promise.resolve());
const mockNotificationAsync = jest.fn(() => Promise.resolve());
jest.mock("expo-haptics", () => ({
  impactAsync: mockImpactAsync,
  notificationAsync: mockNotificationAsync,
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { useGameFeedback } =
  require("../../src/hooks/useGameFeedback") as typeof import("../../src/hooks/useGameFeedback");
const { createNoOpAudioService } =
  require("../../src/services/audio/NoOpAudioService") as typeof import("../../src/services/audio/NoOpAudioService");
const { AudioServiceProvider } =
  require("../../src/services/audio/AudioServiceProvider") as typeof import("../../src/services/audio/AudioServiceProvider");
const { createMemoryStorageService } =
  require("../../src/services/storage/StorageService") as typeof import("../../src/services/storage/StorageService");
const { StorageServiceProvider } =
  require("../../src/services/storage/StorageServiceProvider") as typeof import("../../src/services/storage/StorageServiceProvider");
const { SettingsProvider, useSettings } =
  require("../../src/state/SettingsProvider") as typeof import("../../src/state/SettingsProvider");
/* eslint-enable @typescript-eslint/no-require-imports */

const audio = createNoOpAudioService();

function wrapper({ children }: { children: ReactNode }) {
  return (
    <StorageServiceProvider service={createMemoryStorageService()}>
      <SettingsProvider>
        <AudioServiceProvider service={audio}>{children}</AudioServiceProvider>
      </SettingsProvider>
    </StorageServiceProvider>
  );
}

const warn = (remainingTurns: number): GameEvent => ({
  type: "timerWarning",
  pieceId: "p1",
  remainingTurns,
});

type Props = { turn: number; events: GameEvent[] };

function useHarness(props: Props) {
  useGameFeedback({
    sessionGeneration: 0,
    turn: props.turn,
    events: props.events,
    status: "playing",
    paused: false,
    combo: 0,
    score: 0,
    previousBest: 0,
  });
  return useSettings();
}

describe("semantic timer warnings", () => {
  beforeEach(() => {
    audio.reset();
    mockImpactAsync.mockClear();
    mockNotificationAsync.mockClear();
  });

  it("fires timer 2 once, timer 1 once, and never on same-turn rerender", async () => {
    const { result, rerender } = await renderHook((props: Props) => useHarness(props), {
      wrapper,
      initialProps: { turn: 0, events: [] },
    });
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await act(async () => rerender({ turn: 1, events: [warn(2)] }));
    await act(async () => rerender({ turn: 1, events: [warn(2)] }));
    await act(async () => rerender({ turn: 2, events: [warn(1)] }));

    expect(audio.cues.map((request) => request.cue)).toEqual(["timerWarning2", "timerWarning1"]);
    expect(mockNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mockImpactAsync).toHaveBeenCalledWith("heavy");
  });
});
