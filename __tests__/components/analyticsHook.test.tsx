import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";

import {
  AnalyticsServiceProvider,
  useAnalytics,
} from "../../src/services/analytics/AnalyticsServiceProvider";
import { createMemoryAnalyticsService } from "../../src/services/analytics/MemoryAnalyticsService";

describe("useAnalytics", () => {
  it("routes events to the provided service", async () => {
    const analytics = createMemoryAnalyticsService();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AnalyticsServiceProvider service={analytics}>{children}</AnalyticsServiceProvider>
    );
    const { result } = await renderHook(() => useAnalytics(), { wrapper });

    await act(async () => {
      result.current.track({ name: "app_open" });
    });

    expect(analytics.count("app_open")).toBe(1);
  });

  it("swallows errors from a throwing service so gameplay is never affected", async () => {
    const throwing = createMemoryAnalyticsService({ throwOnTrack: true });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AnalyticsServiceProvider service={throwing}>{children}</AnalyticsServiceProvider>
    );
    const { result } = await renderHook(() => useAnalytics(), { wrapper });

    expect(() => result.current.track({ name: "run_start" })).not.toThrow();
  });

  it("defaults to a working no-op tracker with no provider mounted", async () => {
    const { result } = await renderHook(() => useAnalytics());
    expect(() => result.current.track({ name: "app_open" })).not.toThrow();
  });
});
