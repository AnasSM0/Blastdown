import { act, renderHook } from "@testing-library/react-native";

import type { GameEvent } from "../../src/domain/events";
import { usePraiseCelebration } from "../../src/hooks/usePraiseCelebration";

const clear = (count: number): GameEvent[] => [
  { type: "linesCleared", rows: Array.from({ length: count }, (_, index) => index), columns: [] },
];

describe("usePraiseCelebration", () => {
  it("replaces rapid eligible turns without letting stale completion clear the latest", async () => {
    const { result, rerender } = await renderHook(
      (props: { turn: number; events: GameEvent[] }) => usePraiseCelebration(props),
      { initialProps: { turn: 0, events: [] as GameEvent[] } },
    );
    await act(() => rerender({ turn: 1, events: clear(1) }));
    const firstId = result.current.current?.id;
    await act(() => rerender({ turn: 2, events: clear(2) }));
    expect(result.current.current?.text).toBe("DOUBLE");
    await act(() => result.current.complete(firstId ?? "missing"));
    expect(result.current.current?.text).toBe("DOUBLE");
  });

  it("clears and advances generation on session replacement", async () => {
    const { result, rerender } = await renderHook(
      (props: { turn: number; events: GameEvent[] }) => usePraiseCelebration(props),
      { initialProps: { turn: 0, events: [] as GameEvent[] } },
    );
    await act(() => rerender({ turn: 1, events: clear(1) }));
    const oldSession = result.current.sessionId;
    await act(() => result.current.reset());
    expect(result.current.current).toBeNull();
    expect(result.current.sessionId).toBe(oldSession + 1);
  });
});
