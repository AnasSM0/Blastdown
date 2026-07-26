import { render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { AdsRuntimeProvider } from "../../src/services/ads/AdsRuntimeProvider";
import { useAdService } from "../../src/services/ads/AdServiceProvider";
import { REWARD_PLACEMENTS } from "../../src/services/ads/placements";
import type { AdService } from "../../src/services/ads/types";
import { ConsentProvider, createMockConsentPort } from "../../src/services/consent";
import type { MockConsentConfig } from "../../src/services/consent";

/** Records the gate value in force at each request, which is the only thing
 *  the runtime provider is responsible for wiring. */
function createProbeService() {
  const gateReadings: boolean[] = [];
  let allowed = false;
  let disposeCalls = 0;
  const service: AdService & { gateReadings: boolean[]; disposeCalls: () => number } = {
    gateReadings,
    disposeCalls: () => disposeCalls,
    async preloadRewarded() {},
    async showRewarded() {
      gateReadings.push(allowed);
      return "unavailable";
    },
    async preloadInterstitial() {},
    async showInterstitial() {
      return "unavailable";
    },
    setAdsAllowed(next: boolean) {
      allowed = next;
    },
    dispose() {
      disposeCalls += 1;
    },
  };
  return service;
}

type ProbeService = ReturnType<typeof createProbeService>;

function Consumer({ onService }: { onService: (service: AdService) => void }) {
  const service = useAdService();
  onService(service);
  return <Text testID="consumer">ready</Text>;
}

async function renderRuntime(config: MockConsentConfig) {
  let created: ProbeService | null = null;
  let seen: AdService | null = null;
  const port = createMockConsentPort(config);
  const utils = await render(
    <ConsentProvider port={port} debugEnabled={false}>
      <AdsRuntimeProvider
        createService={() => {
          created = createProbeService();
          return created;
        }}
      >
        <Consumer
          onService={(service) => {
            seen = service;
          }}
        />
      </AdsRuntimeProvider>
    </ConsentProvider>,
  );
  return { utils, port, service: () => created as ProbeService | null, seen: () => seen };
}

describe("ads runtime wiring", () => {
  it("supplies the created service to consumers", async () => {
    const harness = await renderRuntime({});
    await waitFor(() => expect(harness.seen()).not.toBeNull());
    expect(harness.seen()).toBe(harness.service());
  });

  it("reports the gate as closed until consent allows ads", async () => {
    const harness = await renderRuntime({
      gather: { status: "required", isConsentFormAvailable: true, canRequestAds: false },
    });
    await waitFor(() => expect(harness.service()).not.toBeNull());

    await harness.seen()!.showRewarded(REWARD_PLACEMENTS.freeze);
    expect(harness.service()!.gateReadings).toEqual([false]);
  });

  it("opens the gate once consent reports that ads may be requested", async () => {
    const harness = await renderRuntime({ gather: { canRequestAds: true } });
    await waitFor(() => expect(harness.service()).not.toBeNull());
    // The gate is written from an effect, so wait for the committed value
    // rather than the first render.
    await waitFor(async () => {
      await harness.seen()!.showRewarded(REWARD_PLACEMENTS.revive);
      expect(harness.service()!.gateReadings.at(-1)).toBe(true);
    });
  });

  it("keeps the gate closed with no consent provider at all", async () => {
    let created: ProbeService | null = null;
    let seen: AdService | null = null;
    await render(
      <AdsRuntimeProvider
        createService={() => {
          created = createProbeService();
          return created;
        }}
      >
        <Consumer
          onService={(service) => {
            seen = service;
          }}
        />
      </AdsRuntimeProvider>,
    );
    await waitFor(() => expect(created).not.toBeNull());
    const service: ProbeService = created!;

    await seen!.showRewarded(REWARD_PLACEMENTS.doubleBolts);
    expect(service.gateReadings).toEqual([false]);
  });

  it("builds the service once and releases it on unmount", async () => {
    const harness = await renderRuntime({});
    await waitFor(() => expect(harness.service()).not.toBeNull());
    const service = harness.service()!;

    // A consent state change must not rebuild the service: that would drop a
    // preloaded ad and orphan an in-flight presentation.
    expect(service.disposeCalls()).toBe(0);
    await harness.utils.unmount();

    expect(service.disposeCalls()).toBe(1);
  });
});
