import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";

import type { GameEvent } from "../../src/domain/events";

const mockImpactAsync = jest.fn(() => Promise.resolve());
jest.mock("expo-haptics", () => ({
  impactAsync: mockImpactAsync,
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  NotificationFeedbackType: { Success: "success", Warning: "warning" },
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { useTimerHaptics } = require("../../src/hooks/useTimerHaptics");
const { createMemoryStorageService } = require("../../src/services/storage/StorageService");
const { StorageServiceProvider } = require("../../src/services/storage/StorageServiceProvider");
const { SettingsProvider } = require("../../src/state/SettingsProvider");
/* eslint-enable @typescript-eslint/no-require-imports */

function wrapper({ children }: { children: ReactNode }) {
  return (
    <StorageServiceProvider service={createMemoryStorageService()}>
      <SettingsProvider>{children}</SettingsProvider>
    </StorageServiceProvider>
  );
}

const warn = (pieceId: string, remainingTurns: number): GameEvent => ({
  type: "timerWarning",
  pieceId,
  remainingTurns,
});

type Props = { turn: number; events: GameEvent[] };

describe("useTimerHaptics", () => {
  beforeEach(() => mockImpactAsync.mockClear());

  it("buzzes once at countdown 2 and once at countdown 1, and never on re-render", async () => {
    const { rerender } = await renderHook((p: Props) => useTimerHaptics(p), {
      wrapper,
      initialProps: { turn: 0, events: [] as GameEvent[] },
    });

    await act(async () => {
      rerender({ turn: 1, events: [warn("p1", 2)] });
    });
    expect(mockImpactAsync).toHaveBeenCalledTimes(1);

    // Same turn re-render: no extra buzz (no spam).
    await act(async () => {
      rerender({ turn: 1, events: [warn("p1", 2)] });
    });
    expect(mockImpactAsync).toHaveBeenCalledTimes(1);

    // Next turn, the same piece hits countdown 1: one more buzz.
    await act(async () => {
      rerender({ turn: 2, events: [warn("p1", 1)] });
    });
    expect(mockImpactAsync).toHaveBeenCalledTimes(2);
  });

  it("ignores non-urgent timer warnings", async () => {
    const { rerender } = await renderHook((p: Props) => useTimerHaptics(p), {
      wrapper,
      initialProps: { turn: 0, events: [] as GameEvent[] },
    });
    await act(async () => {
      rerender({ turn: 1, events: [warn("p1", 4)] });
    });
    expect(mockImpactAsync).not.toHaveBeenCalled();
  });
});
