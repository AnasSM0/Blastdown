import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { AdServiceProvider } from "../../src/services/ads/AdServiceProvider";
import { createMockAdService } from "../../src/services/ads/MockAdService";
import type { AdService } from "../../src/services/ads/types";
import { useRewardedAction } from "../../src/hooks/useRewardedAction";

function wrapperFor(service: AdService) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <AdServiceProvider service={service}>{children}</AdServiceProvider>;
  };
}

describe("useRewardedAction", () => {
  it("runs onEarned exactly once on an earned reward", async () => {
    const service = createMockAdService({ rewarded: { rewarded_freeze: "earned" } });
    const onEarned = jest.fn();
    const { result } = await renderHook(() => useRewardedAction(), {
      wrapper: wrapperFor(service),
    });

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.run("rewarded_freeze", onEarned);
    });

    expect(outcome).toBe("earned");
    expect(onEarned).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBe(false);
  });

  it.each(["closed", "unavailable", "error"] as const)(
    "never calls onEarned on a %s result",
    async (outcome) => {
      const service = createMockAdService({ rewarded: { rewarded_defuse: outcome } });
      const onEarned = jest.fn();
      const { result } = await renderHook(() => useRewardedAction(), {
        wrapper: wrapperFor(service),
      });

      let got: string | undefined;
      await act(async () => {
        got = await result.current.run("rewarded_defuse", onEarned);
      });

      expect(got).toBe(outcome);
      expect(onEarned).not.toHaveBeenCalled();
    },
  );

  it("ignores a duplicate request while one is in flight (single-flight)", async () => {
    // A service whose show we can resolve on demand, to overlap two calls.
    let resolveShow: (() => void) | undefined;
    const service: AdService = {
      preloadRewarded: async () => {},
      showRewarded: () =>
        new Promise((resolve) => {
          resolveShow = () => resolve("earned");
        }),
      preloadInterstitial: async () => {},
      showInterstitial: async () => "shown",
    };
    const onEarned = jest.fn();
    const { result } = await renderHook(() => useRewardedAction(), {
      wrapper: wrapperFor(service),
    });

    let firstOutcome: Promise<string>;
    let secondOutcome: string | undefined;
    await act(async () => {
      firstOutcome = result.current.run("rewarded_freeze", onEarned);
      // Second call while the first is still pending: rejected as a no-op.
      secondOutcome = await result.current.run("rewarded_freeze", onEarned);
    });
    expect(secondOutcome).toBe("error");

    await act(async () => {
      resolveShow?.();
      await firstOutcome;
    });
    // Only the first, genuine earn fired the callback.
    expect(onEarned).toHaveBeenCalledTimes(1);
  });
});
