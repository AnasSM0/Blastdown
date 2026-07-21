import { act, render } from "@testing-library/react-native";

import { AnalyticsSessionTracker } from "../../src/components/AnalyticsSessionTracker";
import { AnalyticsServiceProvider } from "../../src/services/analytics/AnalyticsServiceProvider";
import { createMemoryAnalyticsService } from "../../src/services/analytics/MemoryAnalyticsService";

describe("AnalyticsSessionTracker", () => {
  it("logs app_open and session_start on mount, session_end with duration on unmount", async () => {
    const analytics = createMemoryAnalyticsService();
    let clock = 1_000;
    const result = await render(
      <AnalyticsServiceProvider service={analytics}>
        <AnalyticsSessionTracker now={() => clock} />
      </AnalyticsServiceProvider>,
    );

    expect(analytics.count("app_open")).toBe(1);
    expect(analytics.count("session_start")).toBe(1);
    expect(analytics.count("session_end")).toBe(0);

    // Advance the clock, then unmount to end the session.
    clock = 6_000;
    await act(async () => {
      result.unmount();
    });

    expect(analytics.count("session_end")).toBe(1);
    expect(analytics.byName("session_end")[0]).toEqual({
      name: "session_end",
      durationMs: 5_000,
    });
  });

  it("does not double-count app_open across a re-render", async () => {
    const analytics = createMemoryAnalyticsService();
    const result = await render(
      <AnalyticsServiceProvider service={analytics}>
        <AnalyticsSessionTracker now={() => 0} />
      </AnalyticsServiceProvider>,
    );
    result.rerender(
      <AnalyticsServiceProvider service={analytics}>
        <AnalyticsSessionTracker now={() => 0} />
      </AnalyticsServiceProvider>,
    );

    expect(analytics.count("app_open")).toBe(1);
    expect(analytics.count("session_start")).toBe(1);
  });
});
