import { render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { ConsentProvider, areAdsAllowed, useConsent } from "../../src/services/consent";
import { createMemoryErrorReporter } from "../../src/services/diagnostics/MemoryErrorReporter";
import {
  resetActiveErrorReporter,
  setActiveErrorReporter,
} from "../../src/services/diagnostics/reportError";

/** Expo Go, and any development build made before the ad SDK was autolinked,
 *  have no Google Mobile Ads native module. The package cannot even be imported
 *  there: its entry point pulls in a module that calls
 *  `TurboModuleRegistry.getEnforcing(...)` while loading, which throws.
 *
 *  This suite is the guard for the regression that caused it — the root layout
 *  imported the SDK at module scope, so the whole app crashed on startup before
 *  a single screen rendered. Gameplay must never depend on ads. */

function loadModulesWithoutSdk() {
  let modules!: {
    isAdsSdkAvailable: typeof import("../../src/services/ads/adsSdk").isAdsSdkAvailable;
    createUmpConsentPort: typeof import("../../src/services/consent/UmpConsentPort").createUmpConsentPort;
    createGoogleRewardedAdPort: typeof import("../../src/services/ads/GoogleRewardedAdPort").createGoogleRewardedAdPort;
    initializeMobileAdsOnce: typeof import("../../src/services/ads/mobileAdsRuntime").initializeMobileAdsOnce;
  };
  jest.isolateModules(() => {
    // Exactly what the real package does when the native module is missing.
    jest.doMock("react-native-google-mobile-ads", () => {
      throw new Error("TurboModuleRegistry.getEnforcing(...): 'RNGoogleMobileAdsConsentModule'");
    });
    // `require` is required here: the modules must be loaded *after* doMock,
    // inside the isolated registry, which a static import cannot do.
    /* eslint-disable @typescript-eslint/no-require-imports */
    modules = {
      isAdsSdkAvailable: require("../../src/services/ads/adsSdk").isAdsSdkAvailable,
      createUmpConsentPort: require("../../src/services/consent/UmpConsentPort")
        .createUmpConsentPort,
      createGoogleRewardedAdPort: require("../../src/services/ads/GoogleRewardedAdPort")
        .createGoogleRewardedAdPort,
      initializeMobileAdsOnce: require("../../src/services/ads/mobileAdsRuntime")
        .initializeMobileAdsOnce,
    };
    /* eslint-enable @typescript-eslint/no-require-imports */
  });
  return modules;
}

function ConsentProbe() {
  const { state } = useConsent();
  return (
    <>
      <Text testID="phase">{state.phase}</Text>
      <Text testID="ads">{areAdsAllowed(state) ? "allowed" : "unavailable"}</Text>
      <Text testID="child">game</Text>
    </>
  );
}

let reporter = createMemoryErrorReporter();

beforeEach(() => {
  reporter = createMemoryErrorReporter();
  setActiveErrorReporter(reporter);
});

afterEach(() => {
  resetActiveErrorReporter();
  jest.dontMock("react-native-google-mobile-ads");
});

describe("no Google Mobile Ads native module", () => {
  it("reports the SDK as unavailable instead of throwing on import", () => {
    const { isAdsSdkAvailable } = loadModulesWithoutSdk();
    expect(isAdsSdkAvailable()).toBe(false);
  });

  it("constructs the consent port without touching the SDK", () => {
    const { createUmpConsentPort } = loadModulesWithoutSdk();
    // Constructing must be safe even here -- app/_layout.tsx does it during
    // render, which is precisely where the crash used to happen.
    expect(() => createUmpConsentPort()).not.toThrow();
  });

  it("constructs the rewarded port without touching the SDK", () => {
    const { createGoogleRewardedAdPort } = loadModulesWithoutSdk();
    expect(() => createGoogleRewardedAdPort()).not.toThrow();
  });

  it("rejects a consent request with an explanation rather than crashing", async () => {
    const { createUmpConsentPort } = loadModulesWithoutSdk();
    await expect(createUmpConsentPort().gather()).rejects.toThrow(/development build/i);
  });

  it("rejects SDK initialization with an explanation", async () => {
    const { initializeMobileAdsOnce } = loadModulesWithoutSdk();
    await expect(initializeMobileAdsOnce()).rejects.toThrow(/Google Mobile Ads is unavailable/i);
  });

  it("leaves the app rendered and playable, with ads simply off", async () => {
    const { createUmpConsentPort } = loadModulesWithoutSdk();
    const result = await render(
      <ConsentProvider port={createUmpConsentPort()} debugEnabled={false}>
        <ConsentProbe />
      </ConsentProvider>,
    );

    // The consent lifecycle fails, which is the correct outcome...
    await waitFor(() => expect(result.getByTestId("phase").props.children).toBe("error"));
    expect(result.getByTestId("ads").props.children).toBe("unavailable");
    // ...and the game renders regardless. This is the whole point.
    expect(result.getByTestId("child")).toBeTruthy();
    // The failure is reported once, so it is diagnosable rather than silent.
    expect(reporter.bySurface("reward").length).toBeGreaterThan(0);
  });
});
