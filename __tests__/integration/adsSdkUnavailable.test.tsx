import { render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { ConsentProvider, areAdsAllowed, useConsent } from "../../src/services/consent";
import { createMemoryErrorReporter } from "../../src/services/diagnostics/MemoryErrorReporter";
import {
  resetActiveErrorReporter,
  setActiveErrorReporter,
} from "../../src/services/diagnostics/reportError";

/** Expo Go, and any development build made before the ad SDK was autolinked,
 *  have no Google Mobile Ads native modules. The package cannot be imported
 *  there at all: its entry point loads eight spec modules, each of which calls
 *  `TurboModuleRegistry.getEnforcing(...)` while loading, and that throws.
 *
 *  This suite guards the regression that caused: the root layout reached the
 *  SDK during render, so the app raised an `Invariant Violation` on every
 *  launch. Gameplay must never depend on ads.
 *
 *  The jest environment registers none of those native modules, so it is
 *  naturally the "SDK absent" case — no mocking is needed to reach it. */

/** A factory that fails the test if it is ever called. The package must not be
 *  required when the native modules are missing; catching the throw is not
 *  enough, because React Native surfaces it in development regardless. */
const packageFactory = jest.fn(() => {
  throw new Error("react-native-google-mobile-ads must not be required without its native modules");
});

function loadModulesWithoutSdk() {
  let modules!: {
    hasAdsNativeModules: typeof import("../../src/services/ads/adsSdk").hasAdsNativeModules;
    isAdsSdkAvailable: typeof import("../../src/services/ads/adsSdk").isAdsSdkAvailable;
    createUmpConsentPort: typeof import("../../src/services/consent/UmpConsentPort").createUmpConsentPort;
    createGoogleRewardedAdPort: typeof import("../../src/services/ads/GoogleRewardedAdPort").createGoogleRewardedAdPort;
    initializeMobileAdsOnce: typeof import("../../src/services/ads/mobileAdsRuntime").initializeMobileAdsOnce;
  };
  jest.isolateModules(() => {
    jest.doMock("react-native-google-mobile-ads", packageFactory);
    // `require` is required here: the modules must be loaded *after* doMock,
    // inside the isolated registry, which a static import cannot do.
    /* eslint-disable @typescript-eslint/no-require-imports */
    modules = {
      hasAdsNativeModules: require("../../src/services/ads/adsSdk").hasAdsNativeModules,
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
  packageFactory.mockClear();
  reporter = createMemoryErrorReporter();
  setActiveErrorReporter(reporter);
});

afterEach(() => {
  resetActiveErrorReporter();
  jest.dontMock("react-native-google-mobile-ads");
});

describe("no Google Mobile Ads native modules", () => {
  it("detects the missing native modules without importing the package", () => {
    const { hasAdsNativeModules, isAdsSdkAvailable } = loadModulesWithoutSdk();

    expect(hasAdsNativeModules()).toBe(false);
    expect(isAdsSdkAvailable()).toBe(false);
    // The important half: the package was never required, so nothing threw and
    // no `Invariant Violation` reached the user.
    expect(packageFactory).not.toHaveBeenCalled();
  });

  it("constructs both ports without touching the SDK", () => {
    const { createUmpConsentPort, createGoogleRewardedAdPort } = loadModulesWithoutSdk();
    // Both are constructed during render in app/_layout.tsx, which is precisely
    // where the crash used to happen.
    expect(() => createUmpConsentPort()).not.toThrow();
    expect(() => createGoogleRewardedAdPort()).not.toThrow();
    expect(packageFactory).not.toHaveBeenCalled();
  });

  it("rejects a consent request with an explanation rather than crashing", async () => {
    const { createUmpConsentPort } = loadModulesWithoutSdk();
    await expect(createUmpConsentPort().gather()).rejects.toThrow(/development build/i);
    expect(packageFactory).not.toHaveBeenCalled();
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
